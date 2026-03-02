#!/usr/bin/env python3
"""
Blink Smart Security Manager
Interface for interacting with blinkpy
"""

import argparse
import asyncio
import json
import logging
from os import path, getenv
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from blinkpy.auth import Auth, BlinkTwoFARequiredError
from blinkpy.blinkpy import Blink

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
BLINK_EMAIL = getenv("BLINK_EMAIL", "")
BLINK_PASSWORD = getenv("BLINK_PASSWORD", "")
BLINK_2FA_CODE = getenv("BLINK_2FA_CODE", "")
AUTH_TOKEN_FILE = Path("config/.blink_auth")

class BlinkManager:
    """Manager for Blink Smart Security API interactions."""

    def __init__(self):
        """Initialize Blink manager."""
        self.blink = None
        self.is_authenticated = False

    async def close(self) -> None:
        """Close the Blink session and cleanup resources."""
        if self.blink:
            # Close the underlying aiohttp session
            if self.blink.auth and hasattr(self.blink.auth, 'session') and self.blink.auth.session:
                await self.blink.auth.session.close()
            self.blink = None
            self.is_authenticated = False
            logger.info("Blink session closed")

    async def authenticate(self, email: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
        """
        Authenticate with Blink Cloud.

        Checks authentication status and re-authenticates if needed.
        Supports 2FA authentication.

        Args:
            email: Blink account email (uses BLINK_EMAIL env var if not provided)
            password: Blink account password (uses BLINK_PASSWORD env var if not provided)

        Returns:
            Dictionary with authentication status and any messages
        """
        try:
            email = email or BLINK_EMAIL
            password = password or BLINK_PASSWORD

            if not email or not password:
                return {
                    "success": False,
                    "authenticated": False,
                    "error": "Email and password required. Set BLINK_EMAIL and BLINK_PASSWORD environment variables."
                }

            if path.exists(AUTH_TOKEN_FILE):
                logger.info("Existing authentication token found, attempting to load...")
                self.blink = Blink()
                with open(AUTH_TOKEN_FILE, 'r') as auth_file:
                    try:
                        auth_data = json.loads(auth_file.read())
                        self.blink.auth = Auth(auth_data, no_prompt=True)
                        self.is_authenticated = True
                    except Exception as e:
                        logger.warning(f"Failed to load existing token: {str(e)}. Re-authenticating...")
            else:
                # Initialize Blink with Auth and no prompting
                logger.info("No existing authentication token found, trying to login with fresh username/password")
                auth = Auth(
                    login_data={
                        "username": email,
                        "password": password
                    },
                    no_prompt=True
                )
                self.blink = Blink()
                self.blink.auth = auth
                logger.info(f"Attempting to authenticate with Blink as {email}")

            # Initialize auth and perform login
            try:
                await self.blink.start()
                self.is_authenticated = True
                return {
                    "success": True,
                    "authenticated": True,
                    "message": "Successfully authenticated with existing token"
                }

            except BlinkTwoFARequiredError:
                logger.error("Two-factor authentication is required but no 2FA code provided")
                await self.blink.send_2fa_code(BLINK_2FA_CODE)
                success_login_verified = await self.blink.setup_post_verify()

                if (success_login_verified):
                    logger.info("Successfully authenticated with 2FA")
                    self.is_authenticated = True
                    await self.blink.save(AUTH_TOKEN_FILE)
                    return {
                        "success": True,
                        "authenticated": True,
                        "message": "Successfully authenticated with Blink (2FA)"
                    }
                else:
                    logger.error("2FA code validation failed")
                    return {
                        "success": False,
                        "authenticated": False,
                        "error": "Two-factor authentication is required. Add the BLINK_2FA_CODE environment variable and run again."
                    }

            except Exception as e:
                logger.error(f"Login failed: {str(e)}")
                return {
                    "success": False,
                    "authenticated": False,
                    "error": f"Login failed: {str(e)}"
                }

        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return {
                "success": False,
                "authenticated": False,
                "error": f"Authentication error: {str(e)}"
            }

    async def list_clips(
        self,
        camera_name: str,
        since_timestamp: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List available clips for a Blink account.

        Args:
            camera_name: Name of the camera to list clips for
            since_timestamp: Only list clips after this Unix timestamp (non-inclusive).
                           If None, defaults to 8 hours ago.

        Returns:
            Dictionary with list of clips and metadata
        """
        try:
            # Ensure authenticated
            if not self.is_authenticated and not self.blink:
                return {
                    "success": False,
                    "clips_downloaded": [],
                    "error": "Not authenticated. Run authenticate() first."
                }

            # If no timestamp provided, default to 8 hours ago
            if since_timestamp is None:
                since_timestamp = (datetime.now() - timedelta(hours=8)).isoformat()
                logger.info(f"No since_timestamp provided, using default: {since_timestamp}")

            # Refresh to get latest data
            logger.info("Refreshing Blink data...")
            await self.blink.refresh()

            try:
                # TODO: `camera` doesn't actually work, it is always returning videos from all cameras
                videos = await self.blink.get_videos_metadata(camera=camera_name, since=since_timestamp)
                logger.info(f"Retrieved {len(videos)} clips for all cameras")

                # Since we actually get all camera videos, sort by camera (`device_name`)
                videos = [video for video in videos if video.get("device_name") == camera_name]
                logger.info(f"Retrieved {len(videos)} clips for camera {camera_name}")
                logger.debug(f"Clips metadata: {videos}")
                return {
                    "success": True,
                    "clips": videos,
                    "message": f"Retrieved {len(videos)} clips for camera {camera_name}"
                }
            except Exception as e:
                logger.warning(f"Error getting videos for {camera_name}: {str(e)}")
                return {
                    "success": False,
                    "clips": [],
                    "error": f"Error getting videos for {camera_name}: {str(e)}"
                }

        except Exception as e:
            logger.error(f"Download error: {str(e)}")
            return {
                "success": False,
                "clips_downloaded": [],
                "error": f"Download failed: {str(e)}"
            }

    async def download_url(self, url: str, save_path: str) -> Dict[str, Any]:
        """Download content from a Blink URL to a local file path."""
        try:
            logger.info(f"Attempting to download URL: {url} to path: {save_path}")

            # Ensure authenticated
            if not self.is_authenticated and not self.blink:
                return {
                    "success": False,
                    "clips_downloaded": [],
                    "error": "Not authenticated. Run authenticate() first."
                }

            response = await self.blink.do_http_get(url)
            file_contents = await response.read()
            with open(save_path, "wb") as f:
                f.write(file_contents)
            logger.info(f"Downloaded URL: {url} to path: {save_path}")
            return {
                "success": True,
            }
        except Exception as e:
            logger.error(f"Failed to download URL {url}: {str(e)}")
            return {
                "success": False,
                "clips_downloaded": [],
                "error": f"Download failed: {str(e)}"
            }

async def main():
    """Command-line interface for Blink manager."""
    parser = argparse.ArgumentParser(
        description="Blink Smart Security Manager"
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Authenticate command
    auth_parser = subparsers.add_parser("authenticate", help="Authenticate with Blink Cloud")
    auth_parser.add_argument("--email", help="Blink account email")
    auth_parser.add_argument("--password", help="Blink account password")

    # List clips command
    list_parser = subparsers.add_parser("list", help="List available clips")
    list_parser.add_argument(
        "--camera-name",
        type=str,
        required=True,
        help="Name of the camera to list clips for"
    )
    list_parser.add_argument(
        "--since-timestamp",
        type=str,
        default=None,
        help="Only list clips after this timestamp in ISO format (default: current time - 8 hours)"
    )

    # Download URL command
    download_parser = subparsers.add_parser("download", help="Download content from a Blink URL")
    download_parser.add_argument(
        "--url",
        type=str,
        required=True,
        help="URL to download content from"
    )
    download_parser.add_argument(
        "--save-path",
        type=str,
        required=True,
        help="Local file path to save the downloaded content"
    )

    args = parser.parse_args()

    manager = BlinkManager()
    result = None

    try:
        if args.command == "authenticate":
            result = await manager.authenticate(args.email, args.password)

        elif args.command == "list":
            # Authenticate first if not already
            if not manager.is_authenticated:
                auth_result = await manager.authenticate()
                logger.info(f"Authentication result: {auth_result}")
                logger.info(f"Authentication result success: {auth_result.get('success')}")
                if not auth_result.get("success"):
                    logger.error("Authentication failed, cannot list clips")
                    sys.exit(1)

            result = await manager.list_clips(
                camera_name=args.camera_name,
                since_timestamp=args.since_timestamp
            )

        elif args.command == "download":
            # Authenticate first if not already
            if not manager.is_authenticated:
                auth_result = await manager.authenticate()
                logger.info(f"Authentication result: {auth_result}")
                logger.info(f"Authentication result success: {auth_result.get('success')}")
                if not auth_result.get("success"):
                    logger.error("Authentication failed, cannot download url")
                    sys.exit(1)

            result = await manager.download_url(args.url, args.save_path)

        else:
            parser.print_help()
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        result = {
            "success": False,
            "error": "Operation cancelled"
        }
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        result = {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }
    finally:
        await manager.close()

    # Output result as JSON to stdout
    if result:
        print(json.dumps(result, indent=2))
        sys.exit(0 if result.get("success", False) else 1)


if __name__ == "__main__":
    asyncio.run(main())
