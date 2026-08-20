//! Almacenamiento de API keys en el llavero del sistema operativo.
//!
//! Windows Credential Manager / macOS Keychain / Linux Secret Service.
//! Las keys nunca se escriben en SQLite ni en logs.

use keyring::Entry;

const SERVICE: &str = "social-persona-studio";

fn entry(reference: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, reference).map_err(|e| format!("No se pudo abrir el llavero: {e}"))
}

#[tauri::command]
pub fn save_secret(reference: String, secret: String) -> Result<(), String> {
    entry(&reference)?
        .set_password(&secret)
        .map_err(|e| format!("No se pudo guardar el secreto: {e}"))
}

#[tauri::command]
pub fn get_secret(reference: String) -> Result<Option<String>, String> {
    match entry(&reference)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("No se pudo leer el secreto: {e}")),
    }
}

#[tauri::command]
pub fn delete_secret(reference: String) -> Result<(), String> {
    match entry(&reference)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("No se pudo borrar el secreto: {e}")),
    }
}

#[tauri::command]
pub fn has_secret(reference: String) -> Result<bool, String> {
    Ok(get_secret(reference)?.is_some())
}
