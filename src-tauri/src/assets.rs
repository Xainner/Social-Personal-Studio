//! Importación de imágenes al almacén local de la aplicación.
//!
//! Cada imagen se copia a `appData/assets/{hash}.{ext}` y genera una miniatura.
//! El hash SHA-256 sirve para deduplicar: la misma imagen subida dos veces
//! reutiliza el archivo existente.

use std::fs;
use std::path::{Path, PathBuf};

use image::GenericImageView;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

const THUMB_MAX: u32 = 512;

#[derive(Serialize)]
pub struct ImportedAsset {
    pub file_path: String,
    pub thumbnail_path: String,
    pub file_hash: String,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub size: u64,
    /// true si el archivo ya existía en el almacén (misma imagen).
    pub deduplicated: bool,
}

fn assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo resolver el directorio de datos: {e}"))?
        .join("assets");
    fs::create_dir_all(dir.join("thumbs"))
        .map_err(|e| format!("No se pudo crear el directorio de imágenes: {e}"))?;
    Ok(dir)
}

fn mime_for(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    }
}

/// Copia una imagen del disco al almacén local, generando hash y miniatura.
///
/// Es `async` a propósito: decodificar y redimensionar una imagen es trabajo
/// pesado, y un comando síncrono lo haría en el hilo principal, congelando la
/// ventana mientras tanto.
#[tauri::command]
pub async fn import_asset(
    app: AppHandle,
    source_path: String,
) -> Result<ImportedAsset, String> {
    tauri::async_runtime::spawn_blocking(move || import_asset_blocking(app, source_path))
        .await
        .map_err(|e| format!("La importacion se interrumpio: {e}"))?
}

fn import_asset_blocking(app: AppHandle, source_path: String) -> Result<ImportedAsset, String> {
    let source = Path::new(&source_path);
    let bytes = fs::read(source).map_err(|e| format!("No se pudo leer la imagen: {e}"))?;

    let hash = format!("{:x}", Sha256::digest(&bytes));
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_ascii_lowercase();

    let dir = assets_dir(&app)?;
    let dest = dir.join(format!("{hash}.{ext}"));
    let thumb = dir.join("thumbs").join(format!("{hash}.jpg"));

    let deduplicated = dest.exists() && thumb.exists();

    let decoded = image::load_from_memory(&bytes)
        .map_err(|e| format!("El archivo no es una imagen válida: {e}"))?;
    let (width, height) = decoded.dimensions();

    if !deduplicated {
        fs::write(&dest, &bytes).map_err(|e| format!("No se pudo guardar la imagen: {e}"))?;
        decoded
            .thumbnail(THUMB_MAX, THUMB_MAX)
            .to_rgb8()
            .save(&thumb)
            .map_err(|e| format!("No se pudo generar la miniatura: {e}"))?;
    }

    Ok(ImportedAsset {
        file_path: dest.to_string_lossy().into_owned(),
        thumbnail_path: thumb.to_string_lossy().into_owned(),
        file_hash: hash,
        mime_type: mime_for(&ext).to_string(),
        width,
        height,
        size: bytes.len() as u64,
        deduplicated,
    })
}

/// Devuelve la imagen como data URL base64, para enviarla a modelos de visión.
///
/// También `async`: leer y codificar en base64 varios cientos de KB no debe
/// bloquear la interfaz.
#[tauri::command]
pub async fn read_asset_as_data_url(file_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || read_data_url_blocking(file_path))
        .await
        .map_err(|e| format!("La lectura se interrumpio: {e}"))?
}

fn read_data_url_blocking(file_path: String) -> Result<String, String> {
    use std::io::Read;

    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("missing_local_asset".to_string());
    }

    let mut file = fs::File::open(path).map_err(|e| format!("No se pudo abrir la imagen: {e}"))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|e| format!("No se pudo leer la imagen: {e}"))?;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_ascii_lowercase();

    Ok(format!(
        "data:{};base64,{}",
        mime_for(&ext),
        base64_encode(&bytes)
    ))
}

/// Borra los archivos de una imagen del almacén local.
#[tauri::command]
pub fn delete_asset_files(file_path: String, thumbnail_path: Option<String>) -> Result<(), String> {
    let _ = fs::remove_file(&file_path);
    if let Some(thumb) = thumbnail_path {
        let _ = fs::remove_file(&thumb);
    }
    Ok(())
}

fn base64_encode(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);

    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(TABLE[(triple >> 18 & 0x3F) as usize] as char);
        out.push(TABLE[(triple >> 12 & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 {
            TABLE[(triple >> 6 & 0x3F) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[(triple & 0x3F) as usize] as char
        } else {
            '='
        });
    }

    out
}

#[cfg(test)]
mod tests {
    use super::base64_encode;

    #[test]
    fn encodes_without_padding() {
        assert_eq!(base64_encode(b"abc"), "YWJj");
    }

    #[test]
    fn encodes_with_padding() {
        assert_eq!(base64_encode(b"a"), "YQ==");
        assert_eq!(base64_encode(b"ab"), "YWI=");
    }

    #[test]
    fn encodes_empty() {
        assert_eq!(base64_encode(b""), "");
    }
}
