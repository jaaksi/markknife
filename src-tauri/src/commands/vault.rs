mod boundary;
mod file_cmds;

pub use file_cmds::*;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    const ACTIVE_VAULT_PATH_ERROR: &str = super::boundary::ACTIVE_VAULT_PATH_ERROR;

    fn vault_path_arg(vault_path: &Path) -> Option<std::path::PathBuf> {
        Some(vault_path.to_path_buf())
    }

    #[test]
    fn test_get_note_content_rejects_path_outside_active_vault() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();
        let inside = vault_path.join("inside.md");
        let outside_dir = tempfile::TempDir::new().unwrap();
        let outside = outside_dir.path().join("outside.md");

        std::fs::write(&inside, "# Inside\n").unwrap();
        std::fs::write(&outside, "# Outside\n").unwrap();

        let err = get_note_content(outside, vault_path_arg(vault_path))
            .expect_err("expected out-of-vault read to be rejected");

        assert_eq!(err, ACTIVE_VAULT_PATH_ERROR);
    }
}
