#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, data).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            read_binary_file,
            write_binary_file,
            read_text_file,
            write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nem3D");
}
