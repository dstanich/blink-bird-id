# Blink Manager - Python Scripts

Python scripts for Blink Smart Security integration using [blinkpy](https://github.com/fronzbot/blinkpy).

## Setup

1. Install Python dependencies (from workspace root):
```bash
uv pip install -e .
```

2. Configure credentials in `.env`:
```bash
cp .env.example .env
# Edit .env with your Blink credentials
```

Environment variables:
- `BLINK_EMAIL`: Your Blink account email
- `BLINK_PASSWORD`: Your Blink account password
- `BLINK_2FA_CODE`: 2FA code if required (optional)

## Usage

### Command Line Interface

All commands output results as JSON to stdout.

#### Authenticate
Validate authentication with Blink Cloud:
```bash
python scripts/blink_manager.py authenticate
```

With explicit credentials:
```bash
python scripts/blink_manager.py authenticate --email user@example.com --password mypassword
```

Returns:
```json
{
  "success": true,
  "authenticated": true,
  "message": "Successfully authenticated with existing token"
}
```

#### List Clips
List available clips for a specific camera:
```bash
python scripts/blink_manager.py list --camera-name "Front Door"
```

With optional timestamp filtering (ISO format):
```bash
python scripts/blink_manager.py list --camera-name "Front Door" --since-timestamp "2026-03-01T10:00:00"
```

If no timestamp is provided, defaults to 8 hours ago.

Returns:
```json
{
  "success": true,
  "clips": [...],
  "message": "Retrieved 5 clips for camera Front Door"
}
```

#### Download Content
Download content from a Blink URL:
```bash
python scripts/blink_manager.py download --url "https://..." --save-path "./downloads/clip.mp4"
```

Returns:
```json
{
  "success": true
}
```

### Python API

Use the `BlinkManager` class directly in Python:
```python
import asyncio
from scripts.blink_manager import BlinkManager

async def main():
    manager = BlinkManager()

    # Authenticate
    auth_result = await manager.authenticate()
    print(auth_result)

    # List clips for a camera
    clips_result = await manager.list_clips(camera_name="Front Door")
    print(clips_result)

    # Download content
    download_result = await manager.download_url(
        url="https://...",
        save_path="./downloads/clip.mp4"
    )
    print(download_result)

    # Clean up
    await manager.close()

asyncio.run(main())
```

## Output Format

All commands output JSON with the following structure:

- `success` (boolean): Whether the operation succeeded
- `authenticated` (boolean): Authentication status (authenticate command only)
- `message` (string): Success message
- `clips` (array): List of clips metadata (list command only)
- `error` (string): Error message if operation failed

## Security Notes

- Never commit `.env` file to version control (already in `.gitignore`)
- Use strong, unique passwords for your Blink account
- If using 2FA, provide `BLINK_2FA_CODE` via environment variable
- Auth tokens are stored locally in `config/.blink_auth` (excluded from git)
