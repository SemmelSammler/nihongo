//! Desktop-Hülle: zeigt die Web-Oberfläche aus web/ an und ergänzt, was der Browser im Fenster nicht kann.
use std::fs;
use tauri_plugin_dialog::DialogExt;

/// „Speichern unter“-Dialog für das Backup. None = abgebrochen.
/// (Download-Links funktionieren im Mac-Fenster nicht, deshalb dieser Weg.)
#[tauri::command]
async fn save_file_dialog(app: tauri::AppHandle, contents: String, default_name: String) -> Result<Option<String>, String> {
  let picked = app
    .dialog()
    .file()
    .add_filter("JSON", &["json"])
    .set_file_name(&default_name)
    .blocking_save_file();
  match picked {
    None => Ok(None),
    Some(fp) => {
      let path = fp.into_path().map_err(|e| e.to_string())?;
      fs::write(&path, contents.as_bytes()).map_err(|e| e.to_string())?;
      Ok(Some(path.to_string_lossy().into_owned()))
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![save_file_dialog])
    .run(tauri::generate_context!())
    .expect("Fehler beim Starten der App");
}
