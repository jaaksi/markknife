use std::borrow::Cow;
use std::fs;
use std::io::{Error, ErrorKind, Write};
use std::path::Path;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

const SAVE_RETRY_DELAYS_MS: [u64; 4] = [25, 50, 100, 200];
static MARKDOWN_FILE_IO: Mutex<()> = Mutex::new(());

#[derive(Debug, serde::Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MarkdownWriteError {
    Conflict { content: Option<String> },
    Io { message: String },
}

fn read_optional_content(path: &Path) -> Result<Option<String>, Error> {
    match fs::read(path) {
        Ok(bytes) => String::from_utf8(bytes)
            .map(Some)
            .map_err(|_| Error::new(ErrorKind::InvalidData, invalid_utf8_text_error(path))),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

/// 跨窗口与保存共用锁，避免检查到本应用写入过程中的中间状态。
pub fn read_markdown_file_state(path: &str) -> Result<Option<String>, String> {
    let _guard = MARKDOWN_FILE_IO.lock().map_err(|e| e.to_string())?;
    let normalized = RawNotePath(path).normalized_for_file_io();
    read_optional_content(Path::new(normalized.as_ref())).map_err(|e| e.to_string())
}

/// 先校验上次读取/保存的内容，再原子替换；跨窗口串行化，重试时重新校验。
pub fn save_markdown_file_checked(
    path: &str,
    content: &str,
    expected_content: Option<&str>,
) -> Result<(), MarkdownWriteError> {
    let io_error = |error: Error| MarkdownWriteError::Io {
        message: note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &error),
    };
    let _guard = MARKDOWN_FILE_IO
        .lock()
        .map_err(|e| io_error(Error::other(e.to_string())))?;
    let normalized = RawNotePath(path).normalized_for_file_io();
    let requested = Path::new(normalized.as_ref());
    // 保存符号链接时替换其目标文件，保留链接本身。
    let canonical = if requested.exists() {
        Some(fs::canonicalize(requested).map_err(io_error)?)
    } else {
        None
    };
    let target = canonical.as_deref().unwrap_or(requested);
    for delay in SAVE_RETRY_DELAYS_MS
        .into_iter()
        .map(Some)
        .chain(std::iter::once(None))
    {
        let current = read_optional_content(target).map_err(io_error)?;
        if current.as_deref() != expected_content {
            // 另一窗口已保存了完全相同的内容时无需再写。
            if expected_content.is_some() && current.as_deref() == Some(content) {
                return Ok(());
            }
            return Err(MarkdownWriteError::Conflict { content: current });
        }
        let result = (|| -> Result<(), Error> {
            let parent = target.parent().ok_or_else(|| {
                Error::new(ErrorKind::InvalidInput, "File has no parent directory")
            })?;
            if expected_content.is_none() {
                fs::create_dir_all(parent)?;
            }
            validate_save_path(target, path).map_err(Error::other)?;
            let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
            if target.exists() {
                temporary
                    .as_file()
                    .set_permissions(fs::metadata(target)?.permissions())?;
            }
            temporary.write_all(content.as_bytes())?;
            temporary.as_file().sync_all()?;
            // 临时文件准备期间外部也可能修改原文件；替换前再读一次。
            if read_optional_content(target)?.as_deref() != expected_content {
                return Err(Error::new(
                    ErrorKind::Interrupted,
                    "File changed while saving",
                ));
            }
            if expected_content.is_none() {
                temporary.persist_noclobber(target).map_err(|e| e.error)?;
            } else {
                temporary.persist(target).map_err(|e| e.error)?;
            }
            Ok(())
        })();
        match result {
            Ok(()) => return Ok(()),
            Err(error)
                if error.kind() == ErrorKind::Interrupted
                    || error.kind() == ErrorKind::AlreadyExists =>
            {
                return Err(MarkdownWriteError::Conflict {
                    content: read_optional_content(target).map_err(io_error)?,
                });
            }
            Err(error) if is_retryable_save_error(&error) => {
                if let Some(delay) = delay {
                    thread::sleep(Duration::from_millis(delay));
                } else {
                    return Err(io_error(error));
                }
            }
            Err(error) => return Err(io_error(error)),
        }
    }
    unreachable!()
}

fn invalid_utf8_text_error(path: &Path) -> String {
    format!("File is not valid UTF-8 text: {}", path.display())
}

fn is_invalid_platform_path_error(error: &Error) -> bool {
    error.kind() == ErrorKind::InvalidInput || error.raw_os_error() == Some(123)
}

fn is_retryable_save_error(error: &Error) -> bool {
    error.kind() == ErrorKind::PermissionDenied
        || (cfg!(windows) && error.raw_os_error() == Some(5))
}

fn write_with_retry(
    mut write_once: impl FnMut() -> Result<(), Error>,
    mut wait_before_retry: impl FnMut(u64),
) -> Result<(), Error> {
    for delay in SAVE_RETRY_DELAYS_MS {
        match write_once() {
            Ok(()) => return Ok(()),
            Err(error) if is_retryable_save_error(&error) => wait_before_retry(delay),
            Err(error) => return Err(error),
        }
    }
    write_once()
}

fn read_existing_note_bytes(path: &Path) -> Result<Vec<u8>, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }
    fs::read(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

struct RawNotePath<'a>(&'a str);

impl<'a> RawNotePath<'a> {
    fn is_windows_verbatim(&self) -> bool {
        self.0.starts_with(r"\\?\") || self.0.starts_with(r"\??\")
    }

    fn normalized_for_file_io(&self) -> Cow<'a, str> {
        if !self.is_windows_verbatim() {
            return Cow::Borrowed(self.0);
        }
        if !self.0.contains('/') {
            return Cow::Borrowed(self.0);
        }
        Cow::Owned(self.0.replace('/', r"\"))
    }
}

#[derive(Clone, Copy)]
enum NoteIoOperation {
    Save,
    Create,
}

#[derive(Clone, Copy)]
struct NotePathDisplay<'a> {
    value: &'a str,
}

impl<'a> NotePathDisplay<'a> {
    fn new(value: &'a str) -> Self {
        Self { value }
    }
}

impl NoteIoOperation {
    fn verb(self) -> &'static str {
        match self {
            Self::Save => "save",
            Self::Create => "create",
        }
    }
}

fn note_io_error(operation: NoteIoOperation, path: NotePathDisplay<'_>, error: &Error) -> String {
    let verb = operation.verb();
    if is_invalid_platform_path_error(error) {
        let path = path.value;
        format!(
            "Failed to {verb} note: the path is invalid on this platform. Rename the note or move it to a valid folder, then try again. Path: {path}"
        )
    } else {
        let path = path.value;
        format!("Failed to {verb} {path}: {error}")
    }
}

/// Read the content of a single note file.
pub fn get_note_content(path: &Path) -> Result<String, String> {
    let bytes = read_existing_note_bytes(path)?;
    String::from_utf8(bytes).map_err(|_| invalid_utf8_text_error(path))
}

/// Check whether a note still has the exact content the renderer cached.
pub fn note_content_matches(path: &Path, expected_content: &str) -> Result<bool, String> {
    let bytes = read_existing_note_bytes(path)?;
    Ok(bytes == expected_content.as_bytes())
}

fn validate_save_path(file_path: &Path, display_path: &str) -> Result<(), String> {
    let parent_missing = file_path.parent().is_some_and(|p| !p.exists());
    if parent_missing {
        return Err(format!(
            "Parent directory does not exist: {}",
            file_path.parent().unwrap().display()
        ));
    }
    let is_readonly = file_path.exists()
        && file_path
            .metadata()
            .map(|m| m.permissions().readonly())
            .unwrap_or(false);
    if is_readonly {
        return Err(format!("File is read-only: {}", display_path));
    }
    Ok(())
}

/// Write content to a note file. Creates parent directory if needed, validates path,
/// then writes content to disk.
pub fn save_note_content(path: &str, content: &str) -> Result<(), String> {
    let normalized_path = RawNotePath(path).normalized_for_file_io();
    let file_path = Path::new(normalized_path.as_ref());
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e)
            })?;
        }
    }
    validate_save_path(file_path, path)?;
    write_with_retry(
        || fs::write(file_path, content),
        |delay| thread::sleep(Duration::from_millis(delay)),
    )
    .map_err(|e| note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e))
}

/// Create a new note file without overwriting any existing file.
pub fn create_note_content(path: &str, content: &str) -> Result<(), String> {
    let normalized_path = RawNotePath(path).normalized_for_file_io();
    let file_path = Path::new(normalized_path.as_ref());
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                note_io_error(NoteIoOperation::Create, NotePathDisplay::new(path), &e)
            })?;
        }
    }
    validate_save_path(file_path, path)?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(file_path)
        .map_err(|e| match e.kind() {
            ErrorKind::AlreadyExists => format!("File already exists: {}", path),
            _ => note_io_error(NoteIoOperation::Create, NotePathDisplay::new(path), &e),
        })?;
    file.write_all(content.as_bytes())
        .map_err(|e| note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checked_save_preserves_external_edits() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "external edit").unwrap();
        let error = save_markdown_file_checked(path.to_str().unwrap(), "my edit", Some("original"))
            .unwrap_err();
        assert!(
            matches!(error, MarkdownWriteError::Conflict { content: Some(ref value) } if value == "external edit")
        );
        assert_eq!(fs::read_to_string(path).unwrap(), "external edit");
    }

    #[test]
    fn checked_save_updates_the_expected_version_atomically() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "original").unwrap();
        save_markdown_file_checked(path.to_str().unwrap(), "my edit", Some("original")).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "my edit");
        assert!(
            save_markdown_file_checked(path.to_str().unwrap(), "stale edit", Some("original"))
                .is_err()
        );
        assert_eq!(fs::read_to_string(path).unwrap(), "my edit");
    }

    #[test]
    fn checked_save_does_not_recreate_a_deleted_file_without_confirmation() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        let error = save_markdown_file_checked(path.to_str().unwrap(), "my edit", Some("original"))
            .unwrap_err();
        assert!(matches!(
            error,
            MarkdownWriteError::Conflict { content: None }
        ));
        assert!(!path.exists());
        save_markdown_file_checked(path.to_str().unwrap(), "my edit", None).unwrap();
        assert_eq!(fs::read_to_string(path).unwrap(), "my edit");
    }

    #[test]
    fn checked_create_never_overwrites_an_existing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "existing").unwrap();
        assert!(save_markdown_file_checked(path.to_str().unwrap(), "copy", None).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "existing");
    }

    #[test]
    fn checked_save_accepts_identical_content_from_another_window() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "same edit").unwrap();
        save_markdown_file_checked(path.to_str().unwrap(), "same edit", Some("original")).unwrap();
    }

    #[test]
    fn checked_saves_from_two_windows_cannot_both_replace_the_same_version() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "original").unwrap();
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
        let handles: Vec<_> = ["first edit", "second edit"]
            .into_iter()
            .map(|content| {
                let path = path.clone();
                let barrier = barrier.clone();
                thread::spawn(move || {
                    barrier.wait();
                    save_markdown_file_checked(path.to_str().unwrap(), content, Some("original"))
                })
            })
            .collect();
        let results: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
        assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
        assert_eq!(results.iter().filter(|r| r.is_err()).count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn checked_save_preserves_symbolic_links() {
        let dir = tempfile::TempDir::new().unwrap();
        let target = dir.path().join("target.md");
        let link = dir.path().join("link.md");
        fs::write(&target, "original").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();
        save_markdown_file_checked(link.to_str().unwrap(), "my edit", Some("original")).unwrap();
        assert!(fs::symlink_metadata(link).unwrap().file_type().is_symlink());
        assert_eq!(fs::read_to_string(target).unwrap(), "my edit");
    }

    #[test]
    fn formats_windows_invalid_path_syntax_as_recoverable_save_error() {
        let path = r"C:\Users\@raflymln\notes\untitled-note-1777236475.md";
        let message = note_io_error(
            NoteIoOperation::Save,
            NotePathDisplay::new(path),
            &Error::from_raw_os_error(123),
        );

        assert!(message.contains("path is invalid on this platform"));
        assert!(message.contains("Rename the note or move it to a valid folder"));
        assert!(!message.contains("os error 123"));
    }

    #[test]
    fn normalizes_extended_windows_paths_before_file_io() {
        let path = r"\\?\C:\Users\alex\Documents\Markknife/Getting Started/untitled-project.md";

        assert_eq!(
            RawNotePath(path).normalized_for_file_io(),
            r"\\?\C:\Users\alex\Documents\Markknife\Getting Started\untitled-project.md"
        );
    }

    #[test]
    fn retries_transient_access_denied_save_errors() {
        let mut attempts = 0;
        let mut delays = Vec::new();

        write_with_retry(
            || {
                attempts += 1;
                if attempts == 1 {
                    Err(Error::new(ErrorKind::PermissionDenied, "Access is denied"))
                } else {
                    Ok(())
                }
            },
            |delay| delays.push(delay),
        )
        .unwrap();

        assert_eq!(attempts, 2);
        assert_eq!(delays, vec![25]);
    }

    #[test]
    fn note_content_matches_detects_external_edits() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "# Fresh\n").unwrap();

        assert!(note_content_matches(&path, "# Fresh\n").unwrap());
        assert!(!note_content_matches(&path, "# Stale\n").unwrap());
    }
}
