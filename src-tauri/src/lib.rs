use tauri::Builder;
use std::sync::{Arc, Mutex};
use std::sync::atomic::AtomicBool;

mod serial_manager;


// Wrapper struct to match what serial_manager expects if not using the module directly?
// Actually lib.rs usually just calls the module.
// Let's check how main.rs calls it.

// Wait, the previous file content showed:
// .manage(SerialManager::SerialState { port: ... })
// But serial_manager.rs defines `pub struct SerialState`.
// So it should be `serial_manager::SerialState`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(serial_manager::SerialState { 
            port: Mutex::new(None),
            running: Arc::new(AtomicBool::new(false)),
            active_port: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            serial_manager::list_ports,
            serial_manager::open_port,
            serial_manager::close_port,
            serial_manager::send_data,
            serial_manager::log_to_file,
            serial_manager::get_connection_status,
            serial_manager::write_to_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
