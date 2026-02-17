use tauri::{AppHandle, Emitter, State};
use serialport::SerialPort;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use std::thread;
use std::io::{Read, Write};

pub struct SerialState {
    pub port: Mutex<Option<Box<dyn SerialPort>>>,
    pub running: Arc<AtomicBool>,
    pub active_port: Mutex<Option<String>>,
}

#[derive(serde::Serialize, Clone)]
struct Payload {
    data: Vec<u8>,
}

#[tauri::command]
pub fn list_ports() -> Result<Vec<String>, String> {
    match serialport::available_ports() {
        Ok(ports) => Ok(ports.into_iter().map(|p| p.port_name).collect()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn open_port(
    port_name: String,
    baud_rate: u32,
    data_bits: u8,
    stop_bits: u8,
    parity: String,
    flow_control: String,
    app: AppHandle,
    state: State<'_, SerialState>,
) -> Result<(), String> {
    let mut port_guard = state.port.lock().map_err(|e| e.to_string())?;
    
    if port_guard.is_some() {
        return Err("Port already open".to_string());
    }

    // Parse data bits
    let data_bits = match data_bits {
        5 => serialport::DataBits::Five,
        6 => serialport::DataBits::Six,
        7 => serialport::DataBits::Seven,
        8 => serialport::DataBits::Eight,
        _ => return Err("Invalid data bits. Must be 5, 6, 7, or 8".to_string()),
    };

    // Parse stop bits
    let stop_bits = match stop_bits {
        1 => serialport::StopBits::One,
        2 => serialport::StopBits::Two,
        _ => return Err("Invalid stop bits. Must be 1 or 2".to_string()),
    };

    // Parse parity
    let parity = match parity.to_lowercase().as_str() {
        "none" => serialport::Parity::None,
        "odd" => serialport::Parity::Odd,
        "even" => serialport::Parity::Even,
        _ => return Err("Invalid parity. Must be 'none', 'odd', or 'even'".to_string()),
    };

    // Parse flow control
    let flow_control = match flow_control.to_lowercase().as_str() {
        "none" => serialport::FlowControl::None,
        "software" => serialport::FlowControl::Software,
        "hardware" => serialport::FlowControl::Hardware,
        _ => return Err("Invalid flow control. Must be 'none', 'software', or 'hardware'".to_string()),
    };

    let port = serialport::new(&port_name, baud_rate)
        .timeout(Duration::from_millis(10))
        .data_bits(data_bits)
        .stop_bits(stop_bits)
        .parity(parity)
        .flow_control(flow_control)
        .open()
        .map_err(|e| e.to_string())?;

    // Clone the port to use in the read thread
    let mut read_port = port.try_clone().map_err(|e| e.to_string())?;
    
    // Store the port name to return it in status checks
    *state.active_port.lock().map_err(|e| e.to_string())? = Some(port_name);

    // Set running flag to true
    state.running.store(true, Ordering::SeqCst);
    let running_flag = state.running.clone();

    *port_guard = Some(port);
    
    // Spawn read thread
    thread::spawn(move || {
        let mut serial_buf: Vec<u8> = vec![0; 1000]; // 1KB buffer
        loop {
            // Check if we should stop
            if !running_flag.load(Ordering::SeqCst) {
                break;
            }

            match read_port.read(serial_buf.as_mut_slice()) {
                Ok(t) => {
                    if t > 0 {
                        let data = serial_buf[..t].to_vec();
                        if let Err(_) = app.emit("serial-data", Payload { data }) {
                            break; // App closed
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    // Timeout is expected, continue loop to check running_flag again
                    continue;
                },
                Err(_) => {
                    // Read failed (port closed?), exit loop
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn get_connection_status(state: State<'_, SerialState>) -> Result<Option<String>, String> {
    let active_port = state.active_port.lock().map_err(|e| e.to_string())?;
    Ok(active_port.clone())
}

#[tauri::command]
pub fn close_port(state: State<'_, SerialState>) -> Result<(), String> {
    let mut port_guard = state.port.lock().map_err(|e| e.to_string())?;
    // Signal thread to stop
    state.running.store(false, Ordering::SeqCst);
    
    // Clear active port name
    *state.active_port.lock().map_err(|e| e.to_string())? = None;
    
    // Drop the port handle in the main thread
    *port_guard = None; 
    
    // The read thread will see the flag within 10ms and exit, dropping its clone.
    Ok(())
}

#[tauri::command]
pub fn send_data(data: Vec<u8>, state: State<'_, SerialState>) -> Result<(), String> {
    let mut port_guard = state.port.lock().map_err(|e| e.to_string())?;
    if let Some(port) = port_guard.as_mut() {
        // write_all expects bytes.
        port.write_all(&data).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No port open".to_string())
    }
}

#[tauri::command]
pub fn log_to_file(path: String, data: Vec<u8>) -> Result<(), String> {
    use std::fs::{OpenOptions, create_dir_all};
    use std::path::Path;
    
    // Ensure parent directories exist
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            create_dir_all(parent).map_err(|e| format!("Failed to create log directory: {}", e))?;
        }
    }
    
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
        
    file.write_all(&data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn write_to_file(path: String, data: Vec<u8>) -> Result<(), String> {
    use std::fs::{OpenOptions, create_dir_all};
    use std::path::Path;
    
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }
    
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
        
    file.write_all(&data).map_err(|e| e.to_string())?;
    Ok(())
}
