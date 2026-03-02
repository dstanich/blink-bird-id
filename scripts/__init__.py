"""
Blink Manager API wrapper for direct Python usage.
Provides synchronous wrappers around the async Blink manager.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from blink_manager import BlinkManager

logger = logging.getLogger(__name__)

class BlinkManagerAPI:
    """Synchronous API wrapper for BlinkManager"""

    def __init__(self):
        """Initialize the API."""
        self.manager = BlinkManager()

    def authenticate(self, email: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
        """
        Authenticate with Blink Cloud.

        Args:
            email: Blink account email
            password: Blink account password

        Returns:
            Dictionary with authentication status
        """
        return asyncio.run(self.manager.authenticate(email, password))

    def list_clips(self, camera_name: str, since_timestamp: Optional[str] = None) -> Dict[str, Any]:
        """
        List available clips for a Blink account.

        Args:
            camera_name: Name of the camera to list clips for
            since_timestamp: Only list clips after this timestamp in ISO format.

        Returns:
            Dictionary with list of clips and metadata
        """
        return asyncio.run(self.manager.list_clips(camera_name, since_timestamp))

    def download_url(self, url: str, save_path: str) -> bool:
        """
        Download content from a Blink URL.

        Args:
            url: URL to download content from
            save_path: Local file path to save the downloaded content

        Returns:
            True if download was successful, False otherwise
        """
        return asyncio.run(self.manager.download_url(url))


# Convenience functions for direct import usage
# def authenticate(email: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
#     """Authenticate with Blink Cloud."""
#     api = BlinkManagerAPI()
#     return api.authenticate(str] = None
# ) -> Dict[str, Any]:
#     """
#     List available clips for a Blink account.

#     Args:
#         camera_name: Name of the camera to list clips for
#         since_timestamp: Only list clips after this timestamp in ISO format.
#                        If None, defaults to 8 hours ago.

#     Returns:
#         Dictionary with list of clips and metadata

#     camera_name: str,
#     since_timestamp: Optional[int] = None
# ) -> Dict[str, Any]:
#     """List available clips for a Blink account."""
#     api = BlinkManagerAPI()
#     return api.list_clips(camera_name, since_timestamp)
