use serde::Serialize;
use url::Url;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedUrl {
    pub url: String,
    pub normalized: String,
    pub hostname: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AppErrorCode {
    EmptyUrl,
    UnsafeUrl,
    CredentialsNotAllowed,
    InvalidHost,
    Io,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
}

impl AppError {
    pub fn new(code: AppErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

pub fn normalize_url(raw: &str) -> Result<NormalizedUrl, AppError> {
    let input = raw.trim();
    if input.is_empty() {
        return Err(AppError::new(AppErrorCode::EmptyUrl, "URL cannot be empty."));
    }

    let candidate = if has_explicit_scheme(input) {
        input.to_owned()
    } else {
        format!("https://{input}")
    };
    let parsed = Url::parse(&candidate)
        .map_err(|_| AppError::new(AppErrorCode::InvalidHost, "URL hostname is invalid."))?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::new(
            AppErrorCode::UnsafeUrl,
            "Only HTTP and HTTPS URLs are allowed.",
        ));
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(AppError::new(
            AppErrorCode::CredentialsNotAllowed,
            "Credentials are not allowed in URLs.",
        ));
    }

    let hostname = parsed
        .host_str()
        .filter(|hostname| !hostname.is_empty())
        .ok_or_else(|| AppError::new(AppErrorCode::InvalidHost, "URL hostname is invalid."))?
        .to_owned();
    let canonical = parsed.to_string();

    Ok(NormalizedUrl {
        url: canonical.clone(),
        normalized: canonical,
        hostname,
    })
}

fn has_explicit_scheme(input: &str) -> bool {
    let Some((scheme, _)) = input.split_once(':') else {
        return false;
    };
    let mut characters = scheme.chars();
    matches!(characters.next(), Some(first) if first.is_ascii_alphabetic())
        && characters.all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '+' | '-' | '.')
        })
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::*;

    #[derive(Debug, Deserialize)]
    struct UrlVector {
        input: String,
        url: Option<String>,
        normalized: Option<String>,
        hostname: Option<String>,
        error: Option<String>,
    }

    fn vectors() -> Vec<UrlVector> {
        serde_json::from_str(include_str!("../../tests/fixtures/url-normalization.json"))
            .expect("shared URL normalization fixture is valid JSON")
    }

    fn error_code(error: &AppError) -> String {
        serde_json::to_value(&error.code)
            .expect("error code serializes")
            .as_str()
            .expect("error code is serialized as a string")
            .to_string()
    }

    #[test]
    fn matches_every_successful_canonical_url_vector() {
        for vector in vectors().into_iter().filter(|vector| vector.error.is_none()) {
            let result = normalize_url(&vector.input).expect("vector should normalize");

            assert_eq!(
                result.url,
                vector.url.expect("successful vector has url"),
                "{}",
                vector.input
            );
            assert_eq!(
                result.normalized,
                vector
                    .normalized
                    .expect("successful vector has normalized"),
                "{}",
                vector.input
            );
            assert_eq!(
                result.hostname,
                vector.hostname.expect("successful vector has hostname"),
                "{}",
                vector.input
            );
        }
    }

    #[test]
    fn matches_every_stable_failure_code_in_shared_vectors() {
        for vector in vectors().into_iter().filter(|vector| vector.error.is_some()) {
            let error = normalize_url(&vector.input).expect_err("vector should be rejected");

            assert_eq!(
                error_code(&error),
                vector.error.expect("failure vector has error"),
                "{}",
                vector.input
            );
        }
    }
}
