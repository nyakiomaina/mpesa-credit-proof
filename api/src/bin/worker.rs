use api::config::Config;
use api::db;
use api::worker::Worker;
use tracing_subscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    dotenv::dotenv().ok();

    let config = Config::from_env()?;
    let pool = db::create_pool(&config.database_url).await?;
    let redis_client = redis::Client::open(config.redis_url.as_str())?;

    let worker = Worker::new(pool, redis_client, config);
    worker.run().await?;

    Ok(())
}
