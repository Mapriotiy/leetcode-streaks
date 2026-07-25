from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./leetcode_streaks.db"
    secret_key: str = "dev-secret-key"
    access_token_expire_minutes: int = 60 * 24
    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

    def model_post_init(self, __context: object) -> None:
        if self.database_url.startswith("postgres://"):
            self.database_url = self.database_url.replace(
                "postgres://",
                "postgresql+psycopg://",
                1,
            )


settings = Settings()
