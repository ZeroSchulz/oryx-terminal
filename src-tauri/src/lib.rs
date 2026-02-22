use tauri::Builder;
use std::sync::{Arc, Mutex};
use std::sync::atomic::AtomicBool;

mod serial_manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(serial_manager::SerialState {
            port:         Arc::new(Mutex::new(None)),
            running:      Arc::new(AtomicBool::new(false)),
            reconnecting: Arc::new(AtomicBool::new(false)),
            active_port:  Arc::new(Mutex::new(None)),
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
