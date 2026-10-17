//! owx harness sidecar daemon（骨架）。
//!
//! 讀取 `OWX_HARNESS_PORT`（預設 13110），於 loopback 啟動 boundary。
//! 邊界決策見 `docs/adr/ADR-0004-harness-opencode-boundary.md`。

use std::net::{Ipv4Addr, SocketAddr};
use tracing_subscriber::EnvFilter;

const DEFAULT_PORT: u16 = 13110;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let port = std::env::var("OWX_HARNESS_PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));

    owx_boundary::serve(addr, owx_boundary::AppState::from_env()).await?;
    Ok(())
}
