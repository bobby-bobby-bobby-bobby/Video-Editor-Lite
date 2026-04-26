// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Create the app data directory for proxies / project files
            let app_dir = app
                .path_resolver()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();

            let proxy_dir = app_dir.join("proxies");
            std::fs::create_dir_all(&proxy_dir).ok();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::media::scan_folder,
            commands::media::get_video_metadata,
            commands::proxy::generate_proxy,
            commands::project::save_project,
            commands::project::load_project,
            commands::export::export_video,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
