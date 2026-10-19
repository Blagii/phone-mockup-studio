#!/usr/bin/env python3
"""Start Phone Mockup Studio with correct JavaScript MIME types on any OS."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent
REQUIRED = (
    'index.html', 'promo.js', 'promo-core.js', 'promo-devices.js', 'promo-media.js',
    'promo.css', 'vendor/three/three.module.js',
    'vendor/three/examples/jsm/controls/OrbitControls.js',
    'vendor/three/examples/jsm/loaders/GLTFLoader.js',
    'vendor/three/examples/jsm/environments/RoomEnvironment.js',
    'vendor/three/examples/jsm/utils/BufferGeometryUtils.js',
    'source/apple_iphone_15_pro_max_black(2).glb',
    'source/iphone_17_pro.glb',
    'source/iphone_17_pro_max.glb',
    'source/samsung_galaxy_s25_ultra.glb',
)


class StudioHandler(SimpleHTTPRequestHandler):
    # Do not trust Windows registry or system MIME associations for modules.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.glb': 'model/gltf-binary',
        '.webmanifest': 'application/manifest+json',
    }

    def end_headers(self):
        path = self.path.split('?', 1)[0]
        if path.endswith(('/', '.html', '.js', '.mjs', '.css', '.webmanifest')):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8780)
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument('--open', action='store_true', help='Open the app in your browser')
    args = parser.parse_args()
    missing = [name for name in REQUIRED if not (ROOT / name).is_file()]
    if missing:
        parser.error('Files are missing. Extract the ENTIRE ZIP into a new folder:\n' + '\n'.join(missing))
    if not 0 <= args.port <= 65535:
        parser.error('Port must be between 0 and 65535.')
    handler = partial(StudioHandler, directory=str(ROOT))
    server = None
    # Avoid silently reopening a different, old server already using this port.
    for port in range(args.port, min(args.port + 10, 65536)):
        try:
            server = ThreadingHTTPServer((args.bind, port), handler)
            break
        except OSError:
            continue
    if server is None:
        parser.error('Cannot start the server. Close old servers or choose --port 8800.')
    with server:
        url = f'http://localhost:{server.server_address[1]}/'
        print(f'\nPhone Mockup Studio: {url}', flush=True)
        print(f'Serving: {ROOT}', flush=True)
        print('Keep this window open. Press Ctrl+C to stop.', flush=True)
        if args.open:
            timer = threading.Timer(.5, webbrowser.open, args=(url,))
            timer.daemon = True
            timer.start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
