use async_trait::async_trait;

pub struct StorageService;

#[async_trait]
pub trait StorageBackend: Send + Sync {
    async fn upload(&self, key: &str, data: &[u8]) -> anyhow::Result<String>;
    async fn download(&self, key: &str) -> anyhow::Result<Vec<u8>>;
    async fn delete(&self, key: &str) -> anyhow::Result<()>;
}

pub struct LocalStorage {
    base_path: String,
}

impl LocalStorage {
    pub fn new(base_path: String) -> Self {
        std::fs::create_dir_all(&base_path).unwrap();
        Self { base_path }
    }
}

#[async_trait]
impl StorageBackend for LocalStorage {
    async fn upload(&self, key: &str, data: &[u8]) -> anyhow::Result<String> {
        let path = std::path::Path::new(&self.base_path).join(key);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, data)?;
        Ok(path.to_string_lossy().to_string())
    }

    async fn download(&self, key: &str) -> anyhow::Result<Vec<u8>> {
        let path = std::path::Path::new(&self.base_path).join(key);
        Ok(std::fs::read(path)?)
    }

    async fn delete(&self, key: &str) -> anyhow::Result<()> {
        let path = std::path::Path::new(&self.base_path).join(key);
        std::fs::remove_file(path)?;
        Ok(())
    }
}

impl StorageService {
    pub fn create_backend(storage_type: &str, _config: &crate::config::Config) -> anyhow::Result<Box<dyn StorageBackend>> {
        match storage_type {
            "local" => Ok(Box::new(LocalStorage::new("./storage".to_string()))),
            "s3" | "r2" => {
                // TODO: Implement S3/R2 storage
                anyhow::bail!("S3/R2 storage not yet implemented")
            }
            _ => anyhow::bail!("Unknown storage type: {}", storage_type),
        }
    }
}

