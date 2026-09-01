use std::collections::HashSet;

use crate::url_normalizer::{normalize_url, AppError};

pub trait UrlOpener {
    fn open_url(&self, url: &str) -> Result<(), AppError>;
}

pub fn open_urls_with(opener: &impl UrlOpener, urls: Vec<String>) -> Result<(), AppError> {
    let mut seen = HashSet::new();
    let mut canonical_urls = Vec::new();

    for raw in urls {
        let canonical = normalize_url(&raw)?.url;
        if seen.insert(canonical.clone()) {
            canonical_urls.push(canonical);
        }
    }

    for url in canonical_urls {
        opener.open_url(&url)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use crate::url_normalizer::AppErrorCode;

    use super::*;

    #[derive(Default)]
    struct FakeUrlOpener {
        opened: RefCell<Vec<String>>,
    }

    impl UrlOpener for FakeUrlOpener {
        fn open_url(&self, url: &str) -> Result<(), AppError> {
            self.opened.borrow_mut().push(url.to_owned());
            Ok(())
        }
    }

    #[test]
    fn opens_two_safe_urls_in_input_order() {
        let opener = FakeUrlOpener::default();

        open_urls_with(
            &opener,
            vec![
                "example.com".to_owned(),
                "https://rust-lang.org/learn".to_owned(),
            ],
        )
        .expect("safe URLs should open");

        assert_eq!(
            opener.opened.into_inner(),
            vec![
                "https://example.com/".to_owned(),
                "https://rust-lang.org/learn".to_owned(),
            ]
        );
    }

    #[test]
    fn rejects_file_url_before_opening_any_url() {
        let opener = FakeUrlOpener::default();

        let error = open_urls_with(
            &opener,
            vec![
                "https://example.com".to_owned(),
                "file:///tmp/private".to_owned(),
            ],
        )
        .expect_err("file URL should be rejected");

        assert_eq!(error.code, AppErrorCode::UnsafeUrl);
        assert!(opener.opened.into_inner().is_empty());
    }

    #[test]
    fn rejects_credentials_before_opening_any_url() {
        let opener = FakeUrlOpener::default();

        let error = open_urls_with(
            &opener,
            vec![
                "https://example.com".to_owned(),
                "https://user:pass@example.org".to_owned(),
            ],
        )
        .expect_err("credential URL should be rejected");

        assert_eq!(error.code, AppErrorCode::CredentialsNotAllowed);
        assert!(opener.opened.into_inner().is_empty());
    }

    #[test]
    fn opens_duplicate_canonical_urls_once() {
        let opener = FakeUrlOpener::default();

        open_urls_with(
            &opener,
            vec![
                "example.com".to_owned(),
                "https://example.com/".to_owned(),
            ],
        )
        .expect("duplicate safe URLs should open once");

        assert_eq!(
            opener.opened.into_inner(),
            vec!["https://example.com/".to_owned()]
        );
    }
}
