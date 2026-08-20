//! Respaldo y restauración del estado local (base de datos + imágenes).
//!
//! El respaldo es un ZIP versionado para permitir migraciones futuras.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

const BACKUP_VERSION: u32 = 1;
const DB_FILE: &str = "social-persona-studio.db";

#[derive(Serialize)]
pub struct BackupResult {
    pub path: String,
    pub files: usize,
    pub bytes: u64,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo resolver el directorio de datos: {e}"))
}

#[tauri::command]
pub fn create_backup(
    app: AppHandle,
    destination: String,
    include_assets: bool,
) -> Result<BackupResult, String> {
    let base = data_dir(&app)?;
    let file =
        File::create(&destination).map_err(|e| format!("No se pudo crear el respaldo: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let manifest = format!(
        r#"{{"version":{BACKUP_VERSION},"includes_assets":{include_assets}}}"#
    );
    zip.start_file("manifest.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(manifest.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut files = 0usize;
    let mut bytes = 0u64;

    let db_path = base.join(DB_FILE);
    if db_path.exists() {
        let data = fs::read(&db_path).map_err(|e| format!("No se pudo leer la base: {e}"))?;
        zip.start_file(DB_FILE, options).map_err(|e| e.to_string())?;
        zip.write_all(&data).map_err(|e| e.to_string())?;
        files += 1;
        bytes += data.len() as u64;
    }

    if include_assets {
        let assets = base.join("assets");
        if assets.exists() {
            for entry in WalkDir::new(&assets).into_iter().filter_map(Result::ok) {
                if !entry.file_type().is_file() {
                    continue;
                }
                let rel = entry
                    .path()
                    .strip_prefix(&base)
                    .map_err(|e| e.to_string())?
                    .to_string_lossy()
                    .replace('\\', "/");
                let data = fs::read(entry.path()).map_err(|e| e.to_string())?;
                zip.start_file(rel, options).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
                files += 1;
                bytes += data.len() as u64;
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;

    Ok(BackupResult {
        path: destination,
        files,
        bytes,
    })
}

#[tauri::command]
pub fn restore_backup(app: AppHandle, source: String) -> Result<u32, String> {
    let base = data_dir(&app)?;
    let file = File::open(&source).map_err(|e| format!("No se pudo abrir el respaldo: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("El respaldo no es válido: {e}"))?;

    let mut version = 0u32;
    if let Ok(mut manifest) = archive.by_name("manifest.json") {
        let mut text = String::new();
        manifest.read_to_string(&mut text).ok();
        if let Some(pos) = text.find("\"version\":") {
            version = text[pos + 10..]
                .chars()
                .take_while(char::is_ascii_digit)
                .collect::<String>()
                .parse()
                .unwrap_or(0);
        }
    }

    if version > BACKUP_VERSION {
        return Err(format!(
            "El respaldo fue creado por una versión más nueva de la app (v{version}). Actualizá la aplicación antes de restaurarlo."
        ));
    }

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if name == "manifest.json" {
            continue;
        }
        let out_path: PathBuf = base.join(&name);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        write_atomic(&out_path, &buf)?;
    }

    Ok(version)
}

fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("restore-tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}
