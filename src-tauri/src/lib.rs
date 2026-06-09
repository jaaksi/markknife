pub mod app_updater;
mod commands;
#[cfg(any(test, all(desktop, target_os = "linux")))]
mod linux_appimage;
#[cfg(desktop)]
pub mod menu;
pub mod settings;
pub mod vault;
pub mod vault_list;
#[cfg(desktop)]
mod window_state;

use std::ffi::OsStr;
use std::process::Command;

#[cfg(desktop)]
use std::path::{Path, PathBuf};
#[cfg(desktop)]
use std::sync::Mutex;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub(crate) fn hidden_command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);
    suppress_windows_console(&mut command);
    command
}

#[cfg(windows)]
fn suppress_windows_console(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_windows_console(_command: &mut Command) {}

#[cfg(desktop)]
struct AllowedAssetScopeRoots(Mutex<Vec<PathBuf>>);

fn setup_common_plugins(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) {
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )?;
    }

    app.handle().plugin(tauri_plugin_dialog::init())?;
    Ok(())
}

#[cfg(desktop)]
fn focus_main_window(app_handle: &tauri::AppHandle) {
    use tauri::Manager;

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(desktop)]
fn with_desktop_entry_plugins(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
}

#[cfg(desktop)]
fn setup_deep_link_runtime_registration(
    _app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        use tauri_plugin_deep_link::DeepLinkExt;

        _app.deep_link().register_all()?;
    }

    Ok(())
}

#[cfg(desktop)]
fn setup_desktop_plugins(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    setup_macos_webview_shortcut_prevention(app)?;
    setup_deep_link_runtime_registration(app)?;
    app.handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
    app.handle().plugin(tauri_plugin_process::init())?;
    app.handle().plugin(tauri_plugin_opener::init())?;
    if should_use_native_desktop_menu(std::env::consts::OS) {
        // 改用 Tauri 默认菜单(标准 App/编辑/窗口项)。不再安装旧 Tolaria 菜单——
        // 后者残留大量失效菜单项,且其 ⌘S(保存)等自定义加速键会在 webview 之前
        // 截获按键(且多处于禁用态),导致前端快捷键失效。默认菜单无 Save 项,
        // Cmd+S 等会正常落到 webview 的键盘处理。
        let default_menu = tauri::menu::Menu::default(app.handle())?;
        app.set_menu(default_menu)?;
    }
    setup_custom_window_chrome(app)?;
    window_state::restore_main_window_state(app);
    show_debug_main_window(app);
    Ok(())
}

#[cfg(debug_assertions)]
fn show_debug_main_window(app: &mut tauri::App) {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.center();
        let _ = window.set_focus();
    }
}

#[cfg(not(debug_assertions))]
fn show_debug_main_window(_app: &mut tauri::App) {}

fn should_use_native_desktop_menu(target_os: &str) -> bool {
    target_os == "macos"
}

#[cfg(all(desktop, any(target_os = "linux", target_os = "windows")))]
fn setup_custom_window_chrome(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_decorations(false);
    }
    Ok(())
}

#[cfg(not(all(desktop, any(target_os = "linux", target_os = "windows"))))]
fn setup_custom_window_chrome(_app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(any(test, all(desktop, target_os = "macos")))]
const MACOS_WEBVIEW_RESERVED_COMMAND_KEYS: &[&str] = &["O", "F"];

#[cfg(all(desktop, target_os = "macos"))]
fn setup_macos_webview_shortcut_prevention(
    app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_prevent_default::ModifierKey::MetaKey;
    use tauri_plugin_prevent_default::{Flags, KeyboardShortcut};

    let mut builder = tauri_plugin_prevent_default::Builder::new().with_flags(Flags::empty());

    // WKWebView can swallow some browser-reserved chords before our shared
    // renderer shortcut handler sees them. Keep this list narrow and verify
    // every addition with native QA.
    for key in MACOS_WEBVIEW_RESERVED_COMMAND_KEYS {
        builder = builder.shortcut(KeyboardShortcut::with_modifiers(key, &[MetaKey]));
    }

    app.handle().plugin(builder.build())?;
    Ok(())
}

#[cfg(not(all(desktop, target_os = "macos")))]
fn setup_macos_webview_shortcut_prevention(
    _app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

/// Windows/Linux 下，双击 / 「打开方式」会把文件路径作为启动参数传入；macOS 走 RunEvent::Opened。
#[cfg(desktop)]
fn capture_cli_open_file(app: &tauri::App) {
    use tauri::Manager;

    let opened = std::env::args().skip(1).find(|arg| {
        let path = std::path::Path::new(arg);
        path.is_file()
            && matches!(
                path.extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.to_ascii_lowercase())
                    .as_deref(),
                Some("md") | Some("markdown")
            )
    });

    if let Some(path) = opened {
        if let Some(state) = app.try_state::<commands::PendingOpenFile>() {
            if let Ok(mut guard) = state.0.lock() {
                *guard = Some(path);
            }
        }
    }
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    setup_common_plugins(app)?;

    #[cfg(desktop)]
    setup_desktop_plugins(app)?;

    #[cfg(desktop)]
    capture_cli_open_file(app);

    Ok(())
}

#[cfg(desktop)]
fn vault_asset_scope_roots(vault_path: &Path) -> Result<Vec<PathBuf>, String> {
    let canonical_vault_path = std::fs::canonicalize(vault_path).map_err(|e| {
        format!(
            "Failed to resolve asset scope for {}: {e}",
            vault_path.display()
        )
    })?;
    let mut roots = vec![canonical_vault_path.clone()];
    let requested_vault_path = vault_path.to_path_buf();
    if requested_vault_path != canonical_vault_path {
        roots.push(requested_vault_path);
    }
    Ok(roots)
}

#[cfg(desktop)]
fn missing_asset_scope_roots(
    allowed_roots: &[PathBuf],
    requested_roots: &[PathBuf],
) -> Vec<PathBuf> {
    requested_roots
        .iter()
        .filter(|root| !allowed_roots.contains(root))
        .cloned()
        .collect()
}

#[cfg(desktop)]
pub(crate) fn sync_vault_asset_scope(
    app_handle: &tauri::AppHandle,
    vault_path: &Path,
) -> Result<(), String> {
    use tauri::Manager;

    let requested_roots = vault_asset_scope_roots(vault_path)?;
    let scope = app_handle.asset_protocol_scope();
    let state: tauri::State<'_, AllowedAssetScopeRoots> = app_handle.state();
    let mut allowed_roots = state
        .0
        .lock()
        .map_err(|_| "Failed to lock asset scope state".to_string())?;
    let roots_to_allow = missing_asset_scope_roots(&allowed_roots, &requested_roots);

    for root in &roots_to_allow {
        scope
            .allow_directory(root, true)
            .map_err(|e| format!("Failed to allow asset access for {}: {e}", root.display()))?;
    }

    allowed_roots.extend(roots_to_allow);
    Ok(())
}

macro_rules! app_invoke_handler {
    () => {
        tauri::generate_handler![
            commands::read_markdown_file,
            commands::write_markdown_file,
            commands::get_note_content,
            commands::validate_note_content,
            commands::open_vault_file_external,
            commands::save_image,
            commands::copy_image_to_vault,
            commands::update_menu_state,
            commands::trigger_menu_command,
            commands::update_current_window_min_size,
            commands::perform_current_window_titlebar_double_click,
            commands::get_settings,
            commands::save_settings,
            commands::copy_text_to_clipboard,
            commands::read_text_from_clipboard,
            commands::should_use_external_media_preview,
            commands::print_current_webview,
            commands::get_build_number,
            commands::check_for_app_update,
            commands::download_and_install_app_update,
            commands::take_pending_open_file
        ]
    };
}

fn with_invoke_handler(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(app_invoke_handler!())
}

/// 记录「由系统打开方式 / 双击」打开的文件路径：暂存供前端冷启动领取，并实时通知前端（热打开）。
#[cfg(desktop)]
fn record_opened_path(app_handle: &tauri::AppHandle, path: String) {
    use tauri::{Emitter, Manager};

    if let Some(state) = app_handle.try_state::<commands::PendingOpenFile>() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = Some(path.clone());
        }
    }
    let _ = app_handle.emit("open-file", path);
}

#[cfg(desktop)]
fn handle_run_event(app_handle: &tauri::AppHandle, event: &tauri::RunEvent) {
    window_state::handle_run_event(app_handle, event);

    if let tauri::RunEvent::Opened { urls } = event {
        for url in urls {
            if let Ok(path) = url.to_file_path() {
                record_opened_path(app_handle, path.to_string_lossy().into_owned());
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(all(desktop, target_os = "linux"))]
    linux_appimage::apply_startup_env_overrides();

    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = with_desktop_entry_plugins(builder);

    #[cfg(desktop)]
    let builder = builder
        .manage(AllowedAssetScopeRoots(Mutex::new(Vec::new())))
        .manage(window_state::MainWindowFrameState::default())
        .manage(commands::PendingOpenFile::default());

    with_invoke_handler(builder)
        .setup(setup_app)
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(desktop)]
            handle_run_event(app_handle, &event);
        });
}

#[cfg(test)]
mod tests {
    use super::should_use_native_desktop_menu;
    use super::MACOS_WEBVIEW_RESERVED_COMMAND_KEYS;

    #[cfg(desktop)]
    use super::missing_asset_scope_roots;
    #[cfg(desktop)]
    use std::path::PathBuf;

    #[cfg(all(desktop, unix))]
    use super::vault_asset_scope_roots;

    #[test]
    fn macos_webview_shortcut_prevention_includes_reserved_command_keys() {
        assert_eq!(MACOS_WEBVIEW_RESERVED_COMMAND_KEYS, ["O", "F"]);
    }

    #[cfg(all(desktop, unix))]
    #[test]
    fn vault_asset_scope_roots_include_requested_symlink_path() {
        let dir = tempfile::tempdir().unwrap();
        let canonical_vault = dir.path().join("Getting Started");
        let symlinked_vault = dir.path().join("Symlinked Getting Started");
        std::fs::create_dir(&canonical_vault).unwrap();
        std::os::unix::fs::symlink(&canonical_vault, &symlinked_vault).unwrap();

        let roots = vault_asset_scope_roots(&symlinked_vault).unwrap();

        assert_eq!(roots[0], canonical_vault.canonicalize().unwrap());
        assert!(roots.contains(&symlinked_vault));
    }

    #[cfg(desktop)]
    #[test]
    fn missing_asset_scope_roots_keeps_previously_allowed_vaults() {
        let vault_a = PathBuf::from("/vault-a");
        let vault_b = PathBuf::from("/vault-b");
        let allowed_roots = vec![vault_a.clone()];

        assert_eq!(
            missing_asset_scope_roots(&allowed_roots, std::slice::from_ref(&vault_b)),
            vec![vault_b]
        );
        assert!(
            missing_asset_scope_roots(&allowed_roots, std::slice::from_ref(&vault_a)).is_empty()
        );
    }

    #[test]
    fn native_desktop_menu_is_macos_only() {
        assert!(should_use_native_desktop_menu("macos"));
        assert!(!should_use_native_desktop_menu("windows"));
        assert!(!should_use_native_desktop_menu("linux"));
    }
}
