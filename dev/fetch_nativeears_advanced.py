"""Download the two supplied NativeEars catalogues and verify local MP3 copies.

Usage: python dev/fetch_nativeears_advanced.py book3.json book4.json
Catalogue snapshots retain the original episode IDs and declared byte sizes.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import hashlib
import json
import re
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'audio' / 'nativeears'
AGENT = 'Mozilla/5.0 (compatible; StudyRoomAudio/1.0)'


def mpeg_header(data):
    start = 0
    if data[:3] == b'ID3':
        if len(data) < 10 or any(value & 128 for value in data[6:10]):
            raise ValueError('Invalid ID3 size')
        start = 10 + sum(value << shift for value, shift in zip(data[6:10], [21, 14, 7, 0]))
    rates = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}
    bitrates = {3: [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320], 2: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160]}

    def parse(index):
        if index + 4 > len(data):
            return None
        value = int.from_bytes(data[index:index+4], 'big')
        version, layer = (value >> 19) & 3, (value >> 17) & 3
        bitrate, sampling = (value >> 12) & 15, (value >> 10) & 3
        if value >> 21 != 2047 or version == 1 or layer != 1 or not 0 < bitrate < 15 or sampling == 3:
            return None
        kbps, hz = bitrates[3 if version == 3 else 2][bitrate], rates[version][sampling]
        length = (144000 if version == 3 else 72000) * kbps // hz + ((value >> 9) & 1)
        return version, kbps, hz, length

    for index in range(start, min(start + 4096, len(data) - 4)):
        first = parse(index)
        if first:
            second = parse(index + first[3])
            third = parse(index + first[3] + (second[3] if second else 0))
            if second and third and (first[0], first[2]) == (second[0], second[2]) == (third[0], third[2]):
                return {'version': first[0], 'bitrateKbps': first[1], 'sampleRate': first[2]}
    raise ValueError('No consecutive valid MPEG Layer III frames after ID3')


def verify(path, size):
    if path.stat().st_size != size:
        raise ValueError('Downloaded byte size differs from source catalogue')
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    codec = mpeg_header(path.read_bytes())
    return digest.hexdigest(), codec


def download(entry):
    book, number = entry['book'], entry['number']
    target = OUTPUT / f'b{book}-{number:03}.mp3'
    part = target.with_suffix('.mp3.part')
    url = entry['audioUrl']
    if not re.fullmatch(r'https://nativeears\.mojoru\.org/api/audio/\d+', url):
        raise ValueError('Unexpected source URL')
    size = entry['expectedBytes']
    for attempt in range(3):
        try:
            if not target.exists() or target.stat().st_size != size:
                request = urllib.request.Request(url, headers={'User-Agent': AGENT})
                with urllib.request.urlopen(request, timeout=90) as response:
                    if response.status != 200 or 'audio/' not in response.headers.get('Content-Type', ''):
                        raise ValueError('Unexpected audio response')
                    with part.open('wb') as stream:
                        while chunk := response.read(256 * 1024):
                            stream.write(chunk)
                verify(part, size)
                part.replace(target)
            sha, codec = verify(target, size)
            return {'book': book, 'number': number, 'title': entry['cleanTitle'],
                    'sourceTitle': entry['sourceTitle'], 'episodeId': entry['episodeId'],
                    'sourcePage': entry['playerUrl'], 'seriesUrl': entry['seriesUrl'],
                    'path': target.relative_to(ROOT).as_posix(), 'bytes': size,
                    'sha256': sha, 'codec': codec}
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def main():
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    entries = []
    for value in sys.argv[1:]:
        source = json.loads(Path(value).read_text(encoding='utf-8'))
        book = source['book']
        expected = {3: 60, 4: 48}[book]
        rows = source['lessons']
        if sorted(row['number'] for row in rows) != list(range(1, expected + 1)):
            raise ValueError(f'Book {book}: incomplete or duplicate lesson catalogue')
        for row in rows:
            original = row.get('sourceTitle', row['title'])
            entries.append({**row, 'book': book, 'sourceTitle': original,
                            'cleanTitle': row.get('titleWithoutNumber', row['title']),
                            'expectedBytes': row.get('fileSizeBytes', row.get('fileSize')),
                            'seriesUrl': source['seriesUrl']})
    if {entry['book'] for entry in entries} != {3, 4}:
        raise ValueError('Exactly both Book 3 and Book 4 catalogues are required')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    result = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(download, entry): entry for entry in entries}
        for job in as_completed(jobs):
            item = job.result()
            result.append(item)
            print(f"Verified {len(result)}/{len(entries)} b{item['book']}-{item['number']:03} {item['bytes']} bytes", flush=True)
    result.sort(key=lambda item: (item['book'], item['number']))
    catalogue = '/* Verified local copies of the user-supplied Book 3 and Book 4 series. */\nwindow.NATIVEEARS_ADVANCED_CATALOGUE = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n'
    (ROOT / 'nativeears-advanced-catalogue.js').write_text(catalogue, encoding='utf-8')
    (ROOT / 'outputs' / 'audio-source' / 'verified-book34.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"COMPLETE {len(result)} files, {sum(item['bytes'] for item in result)} verified bytes")


if __name__ == '__main__':
    main()
