mod assets;
mod backup;
mod secrets;

use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:social-persona-studio.db";

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "esquema inicial",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            secrets::save_secret,
            secrets::get_secret,
            secrets::delete_secret,
            secrets::has_secret,
            assets::import_asset,
            assets::read_asset_as_data_url,
            assets::delete_asset_files,
            backup::create_backup,
            backup::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
