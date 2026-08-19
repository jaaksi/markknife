//! 应用菜单栏(仅 macOS 装配,见 lib.rs 的 should_use_native_desktop_menu)。
//!
//! 不用 `Menu::default()`:它把「文件 / 编辑 / 显示 / 窗口 / 帮助」及各标准项的文案硬编码成英文,
//! 无法跟随应用语言。这里自己搭一套结构完全相同的菜单(含「历史记录」),构建时把需要改文案的
//! 菜单项句柄一并存进 state,前端推送时逐个 set_text 即可,不必按 id / 位置回查。
//!
//! 文案与「最近打开」列表的真相源都在前端(i18nMessages + localStorage 的 useRecentFiles):
//! 前端在语言或列表变化时整份推过来,后端不持久化、也不含任何用户可见文案——构建时先用与
//! Tauri 默认菜单一致的英文占位,等前端挂载后立刻被覆盖。

use serde::Deserialize;

#[cfg(desktop)]
use tauri::{
    menu::{
        AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID,
        WINDOW_SUBMENU_ID,
    },
    AppHandle, Emitter, Manager, Wry,
};

/// 历史文件项 id 前缀,其后直接拼接文件路径(点击时再原样剥回来)。
#[cfg(desktop)]
const RECENT_ITEM_ID_PREFIX: &str = "markknife:recent:file:";
/// 「清除历史记录」项 id。
#[cfg(desktop)]
const CLEAR_ITEM_ID: &str = "markknife:recent:clear";
/// 列表为空时的占位项 id(禁用态,仅作提示)。
#[cfg(desktop)]
const EMPTY_ITEM_ID: &str = "markknife:recent:empty";

/// 点击历史项后发给前端的事件。
///
/// 没有复用既有的 `open-file` 广播通道:那条通道的监听方是裸 listen(EventTarget::Any),
/// 会短路掉 Tauri 的目标过滤,定向投递会退化成广播(细节见 emit_open_to_focused_window)。
#[cfg(desktop)]
const OPEN_RECENT_EVENT: &str = "menu:open-recent-file";
/// 点击「清除历史记录」后发给前端的事件。
#[cfg(desktop)]
const CLEAR_RECENT_EVENT: &str = "menu:clear-recent-files";

/// 前端推来的整份菜单数据。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppMenuPayload {
    /// 标准菜单(文件 / 编辑 / …)的文案。
    pub standard: StandardLabels,
    /// 「历史记录」子菜单。
    pub recent: RecentSection,
}

/// 标准菜单及标准项的文案。字段与 build() 里创建的菜单项一一对应。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StandardLabels {
    pub file: String,
    pub edit: String,
    pub view: String,
    pub window: String,
    pub help: String,
    pub about: String,
    pub services: String,
    pub hide: String,
    pub hide_others: String,
    pub show_all: String,
    pub quit: String,
    pub close_window: String,
    pub undo: String,
    pub redo: String,
    pub cut: String,
    pub copy: String,
    pub paste: String,
    pub select_all: String,
    pub fullscreen: String,
    pub minimize: String,
    pub zoom: String,
}

/// 「历史记录」子菜单的数据。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSection {
    /// 子菜单标题。
    pub title: String,
    /// 历史文件列表(已由前端排好序、去过重)。
    pub items: Vec<RecentMenuItem>,
    /// 「清除历史记录」项文案。
    pub clear_label: String,
    /// 列表为空时的占位文案。
    pub empty_label: String,
}

/// 一条历史记录:path 用于打开,name 作菜单项显示文字。
#[derive(Debug, Deserialize)]
pub struct RecentMenuItem {
    pub path: String,
    pub name: String,
}

/// 构建时留下的菜单项句柄,供后续按语言改写文案。
///
/// 预定义项(撤销 / 拷贝 / 退出 …)不支持自定义 id,没法事后按 id 回查,所以在这里直接持有引用。
/// 这些包装类型内部是 Arc 且 Send + Sync,克隆进 state 是安全的。
#[cfg(desktop)]
pub struct AppMenuHandles {
    file: Submenu<Wry>,
    edit: Submenu<Wry>,
    view: Submenu<Wry>,
    window: Submenu<Wry>,
    help: Submenu<Wry>,
    recent: Submenu<Wry>,
    about: PredefinedMenuItem<Wry>,
    services: PredefinedMenuItem<Wry>,
    hide: PredefinedMenuItem<Wry>,
    hide_others: PredefinedMenuItem<Wry>,
    show_all: PredefinedMenuItem<Wry>,
    quit: PredefinedMenuItem<Wry>,
    /// 「文件 > 关闭窗口」与「窗口 > 关闭窗口」是两个独立菜单项,需各自改文案。
    close_window_in_file: PredefinedMenuItem<Wry>,
    close_window_in_window: PredefinedMenuItem<Wry>,
    undo: PredefinedMenuItem<Wry>,
    redo: PredefinedMenuItem<Wry>,
    cut: PredefinedMenuItem<Wry>,
    copy: PredefinedMenuItem<Wry>,
    paste: PredefinedMenuItem<Wry>,
    select_all: PredefinedMenuItem<Wry>,
    fullscreen: PredefinedMenuItem<Wry>,
    minimize: PredefinedMenuItem<Wry>,
    zoom: PredefinedMenuItem<Wry>,
}

/// 搭好菜单栏、装到应用上,并把菜单项句柄交给 state 保管。
///
/// 结构与 Tauri 默认菜单保持一致(含各标准项自带的系统加速键),只是文案可替换:默认菜单不含
/// 自定义加速键,⌘S / ⌘O 等仍会落到 webview 的键盘处理,不会被菜单抢先截获。
#[cfg(desktop)]
pub fn install(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();
    let package_info = app_handle.package_info();
    let config = app_handle.config();
    let about_metadata = AboutMetadata {
        name: Some(package_info.name.clone()),
        version: Some(package_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config.bundle.publisher.clone().map(|p| vec![p]),
        ..Default::default()
    };

    // 占位文案沿用 Tauri 默认菜单的英文,前端挂载后会立刻改成当前语言。
    let about = PredefinedMenuItem::about(&app_handle, Some("About"), Some(about_metadata))?;
    let services = PredefinedMenuItem::services(&app_handle, Some("Services"))?;
    let hide = PredefinedMenuItem::hide(&app_handle, Some("Hide"))?;
    let hide_others = PredefinedMenuItem::hide_others(&app_handle, Some("Hide Others"))?;
    let show_all = PredefinedMenuItem::show_all(&app_handle, Some("Show All"))?;
    let quit = PredefinedMenuItem::quit(&app_handle, Some("Quit"))?;
    let close_window_in_file = PredefinedMenuItem::close_window(&app_handle, Some("Close Window"))?;
    let close_window_in_window =
        PredefinedMenuItem::close_window(&app_handle, Some("Close Window"))?;
    let undo = PredefinedMenuItem::undo(&app_handle, Some("Undo"))?;
    let redo = PredefinedMenuItem::redo(&app_handle, Some("Redo"))?;
    let cut = PredefinedMenuItem::cut(&app_handle, Some("Cut"))?;
    let copy = PredefinedMenuItem::copy(&app_handle, Some("Copy"))?;
    let paste = PredefinedMenuItem::paste(&app_handle, Some("Paste"))?;
    let select_all = PredefinedMenuItem::select_all(&app_handle, Some("Select All"))?;
    let fullscreen = PredefinedMenuItem::fullscreen(&app_handle, Some("Toggle Full Screen"))?;
    let minimize = PredefinedMenuItem::minimize(&app_handle, Some("Minimize"))?;
    let zoom = PredefinedMenuItem::maximize(&app_handle, Some("Zoom"))?;

    // 首个子菜单的标题在 macOS 上由 AppKit 强制显示为应用名,这里给什么都不影响,故不参与翻译。
    let app_submenu = Submenu::with_items(
        &app_handle,
        package_info.name.clone(),
        true,
        &[
            &about,
            &PredefinedMenuItem::separator(&app_handle)?,
            &services,
            &PredefinedMenuItem::separator(&app_handle)?,
            &hide,
            &hide_others,
            &show_all,
            &PredefinedMenuItem::separator(&app_handle)?,
            &quit,
        ],
    )?;
    let file = Submenu::with_items(&app_handle, "File", true, &[&close_window_in_file])?;
    let edit = Submenu::with_items(
        &app_handle,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(&app_handle)?,
            &cut,
            &copy,
            &paste,
            &select_all,
        ],
    )?;
    let view = Submenu::with_items(&app_handle, "View", true, &[&fullscreen])?;
    // 先建空的,内容随前端首次推送填入。
    let recent = Submenu::new(&app_handle, "History", true)?;
    // 窗口 / 帮助必须沿用 Tauri 约定的 id:macOS 下 Tauri 按这两个 id 把它们接到 NSApp
    // (set_as_windows_menu_for_nsapp / set_as_help_menu_for_nsapp),换 id 会丢掉原生联动。
    let window = Submenu::with_id_and_items(
        &app_handle,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &minimize,
            &zoom,
            &PredefinedMenuItem::separator(&app_handle)?,
            &close_window_in_window,
        ],
    )?;
    let help = Submenu::with_id_and_items(&app_handle, HELP_SUBMENU_ID, "Help", true, &[])?;

    let menu = Menu::with_items(
        &app_handle,
        &[&app_submenu, &file, &edit, &view, &recent, &window, &help],
    )?;
    app.set_menu(menu)?;

    app.manage(AppMenuHandles {
        file,
        edit,
        view,
        window,
        help,
        recent,
        about,
        services,
        hide,
        hide_others,
        show_all,
        quit,
        close_window_in_file,
        close_window_in_window,
        undo,
        redo,
        cut,
        copy,
        paste,
        select_all,
        fullscreen,
        minimize,
        zoom,
    });
    Ok(())
}

/// 按前端推来的文案改写整条菜单栏,并重建「历史记录」子菜单。菜单未装配(非 macOS)时为空操作。
#[cfg(desktop)]
pub fn apply(app_handle: &AppHandle, payload: &AppMenuPayload) -> Result<(), String> {
    let Some(handles) = app_handle.try_state::<AppMenuHandles>() else {
        return Ok(());
    };
    let labels = &payload.standard;

    let renames: [(&dyn SetMenuText, &str); 22] = [
        (&handles.file, labels.file.as_str()),
        (&handles.edit, labels.edit.as_str()),
        (&handles.view, labels.view.as_str()),
        (&handles.window, labels.window.as_str()),
        (&handles.help, labels.help.as_str()),
        (&handles.about, labels.about.as_str()),
        (&handles.services, labels.services.as_str()),
        (&handles.hide, labels.hide.as_str()),
        (&handles.hide_others, labels.hide_others.as_str()),
        (&handles.show_all, labels.show_all.as_str()),
        (&handles.quit, labels.quit.as_str()),
        (&handles.close_window_in_file, labels.close_window.as_str()),
        (
            &handles.close_window_in_window,
            labels.close_window.as_str(),
        ),
        (&handles.undo, labels.undo.as_str()),
        (&handles.redo, labels.redo.as_str()),
        (&handles.cut, labels.cut.as_str()),
        (&handles.copy, labels.copy.as_str()),
        (&handles.paste, labels.paste.as_str()),
        (&handles.select_all, labels.select_all.as_str()),
        (&handles.fullscreen, labels.fullscreen.as_str()),
        (&handles.minimize, labels.minimize.as_str()),
        (&handles.zoom, labels.zoom.as_str()),
    ];
    for (item, text) in renames {
        item.set_menu_text(text)?;
    }
    handles
        .recent
        .set_menu_text(payload.recent.title.as_str())?;

    rebuild_recent_items(app_handle, &handles.recent, &payload.recent)
}

/// 统一「改文案」这一个动作:子菜单与预定义项是不同类型,但都只需要 set_text。
#[cfg(desktop)]
trait SetMenuText {
    fn set_menu_text(&self, text: &str) -> Result<(), String>;
}

#[cfg(desktop)]
impl SetMenuText for Submenu<Wry> {
    fn set_menu_text(&self, text: &str) -> Result<(), String> {
        self.set_text(text)
            .map_err(|e| format!("更新菜单标题失败: {e}"))
    }
}

#[cfg(desktop)]
impl SetMenuText for PredefinedMenuItem<Wry> {
    fn set_menu_text(&self, text: &str) -> Result<(), String> {
        self.set_text(text)
            .map_err(|e| format!("更新菜单项文案失败: {e}"))
    }
}

/// 清空并重建「历史记录」内容:历史项 → 分隔线 → 清除项;列表为空时只放一个禁用的占位项。
#[cfg(desktop)]
fn rebuild_recent_items(
    app_handle: &AppHandle,
    submenu: &Submenu<Wry>,
    recent: &RecentSection,
) -> Result<(), String> {
    while submenu
        .remove_at(0)
        .map_err(|e| format!("清空历史记录菜单失败: {e}"))?
        .is_some()
    {}

    if recent.items.is_empty() {
        let empty = MenuItem::with_id(
            app_handle,
            EMPTY_ITEM_ID,
            &recent.empty_label,
            false,
            None::<&str>,
        )
        .map_err(|e| format!("创建历史记录占位项失败: {e}"))?;
        return submenu
            .append(&empty)
            .map_err(|e| format!("追加历史记录占位项失败: {e}"));
    }

    for item in &recent.items {
        let entry = MenuItem::with_id(
            app_handle,
            format!("{RECENT_ITEM_ID_PREFIX}{}", item.path),
            &item.name,
            true,
            None::<&str>,
        )
        .map_err(|e| format!("创建历史记录项失败: {e}"))?;
        submenu
            .append(&entry)
            .map_err(|e| format!("追加历史记录项失败: {e}"))?;
    }

    let separator = PredefinedMenuItem::separator(app_handle)
        .map_err(|e| format!("创建历史记录分隔线失败: {e}"))?;
    submenu
        .append(&separator)
        .map_err(|e| format!("追加历史记录分隔线失败: {e}"))?;

    let clear = MenuItem::with_id(
        app_handle,
        CLEAR_ITEM_ID,
        &recent.clear_label,
        true,
        None::<&str>,
    )
    .map_err(|e| format!("创建清除历史记录项失败: {e}"))?;
    submenu
        .append(&clear)
        .map_err(|e| format!("追加清除历史记录项失败: {e}"))
}

/// 从菜单项 id 还原文件路径;不是历史文件项则返回 None。
#[cfg(desktop)]
fn recent_item_path(id: &str) -> Option<&str> {
    id.strip_prefix(RECENT_ITEM_ID_PREFIX)
}

/// 处理菜单点击。命中「历史记录」相关项返回 true,便于调用方判断是否已消费。
#[cfg(desktop)]
pub fn handle_menu_event(app_handle: &AppHandle, id: &str) -> bool {
    if id == CLEAR_ITEM_ID {
        // 清空是广播:历史存在同源 localStorage 里、多窗口共用一份,只清聚焦窗口的话,
        // 其余窗口内存里还留着旧列表,下次记录时又会把它整份写回去,等于没清掉。
        let _ = app_handle.emit(CLEAR_RECENT_EVENT, ());
        return true;
    }
    if let Some(path) = recent_item_path(id) {
        emit_open_to_focused_window(app_handle, path);
        return true;
    }
    false
}

/// 打开事件只投给当前聚焦窗口。
///
/// macOS 的菜单栏是应用级的(多窗口共用一条),若广播,点一次历史项会让每个已开窗口都打开
/// 一遍该文件。注意定向投递要求前端用**窗口级**监听(getCurrentWebviewWindow().listen):
/// 裸 listen 注册的是 EventTarget::Any,而 Tauri 的 match_any_or_filter 对 Any 监听器直接
/// 短路放行、根本不跑目标过滤(event/listener.rs),那样定向就又退化成广播了。
///
/// 没有聚焦窗口(如全部最小化)时退回广播,至少不把事件丢掉。
#[cfg(desktop)]
fn emit_open_to_focused_window(app_handle: &AppHandle, path: &str) {
    let focused = app_handle
        .webview_windows()
        .into_iter()
        .find(|(_, window)| window.is_focused().unwrap_or(false))
        .map(|(label, _)| label);

    let _ = match focused {
        Some(label) => app_handle.emit_to(label, OPEN_RECENT_EVENT, path.to_string()),
        None => app_handle.emit(OPEN_RECENT_EVENT, path.to_string()),
    };
}

/// 非桌面端没有菜单栏,空操作(保持命令签名一致)。
#[cfg(not(desktop))]
pub fn apply(_app_handle: &tauri::AppHandle, _payload: &AppMenuPayload) -> Result<(), String> {
    Ok(())
}

#[cfg(all(test, desktop))]
mod tests {
    use super::*;

    #[test]
    fn recent_item_path_strips_prefix() {
        let id = format!("{RECENT_ITEM_ID_PREFIX}/Users/me/notes/a.md");
        assert_eq!(recent_item_path(&id), Some("/Users/me/notes/a.md"));
    }

    #[test]
    fn recent_item_path_keeps_paths_containing_colons() {
        let id = format!("{RECENT_ITEM_ID_PREFIX}/Users/me/a:b.md");
        assert_eq!(recent_item_path(&id), Some("/Users/me/a:b.md"));
    }

    #[test]
    fn recent_item_path_rejects_other_ids() {
        assert_eq!(recent_item_path(CLEAR_ITEM_ID), None);
        assert_eq!(recent_item_path(EMPTY_ITEM_ID), None);
        assert_eq!(recent_item_path("quit"), None);
    }
}
