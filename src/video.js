import ffmpeg from './ffmpeg-mp4'
import { Parser } from 'm3u8-parser'

function fetchArrayBuffer (vidUrl) {
  return new Promise((resolve, reject) => {
    fetch(vidUrl).then(response => response.arrayBuffer())
      .then(arrayBuffer => {
          resolve(arrayBuffer);
      })
      .catch(error => {
          reject(error);
      });
  })
}

function parsem3u8 (url) {
  return new Promise((resolve, reject) => {
    fetch(url).then(response => response.text())
      .then(text => {
        const parser = new Parser();
        parser.push(text);
        parser.end();
        resolve(parser.manifest);
      })
      .catch(error => {
        reject(error);
      });
  })
}

export default async function download (m3u8URL, { lengthRestriction=-1, onProgress }) {
  function _onProgress (downloadProgress, downloadDone, concatDone, video, stdOut, stdErr) {
    if (onProgress) onProgress({ downloadProgress, downloadDone, concatDone, video, stdOut, stdErr })
  }
  let stdOut = ""
  let stdErr = ""
  _onProgress(0, false, false, null, stdOut, stdErr)

  const baseUrl = m3u8URL.split("/").slice(0, -1).join("/") + "/"
  const manifest = await parsem3u8(m3u8URL)

  const segments = lengthRestriction === -1 ? manifest.segments : manifest.segments.slice(0, lengthRestriction)

  const buffers = []
  let count = 0
  for (const segment of segments) {
    const buffer = await fetchArrayBuffer(baseUrl + segment.uri)
    count += 1

    const progress = count / segments.length
    _onProgress(progress, false, false, null, stdOut, stdErr)

    buffers.push(buffer)
  }
  _onProgress(1, true, false, null, stdOut, stdErr)

  // Now we need to create the MEMFS array and the concat command
  const fs = buffers.map((buffer, index) => ({ name: `${index}.ts`, data: buffer }))
  const concatCommand = `concat:${fs.map(({ name }) => name).join("|")}`
  const args = `-i ${concatCommand} -c copy out.mp4`.split(" ")

  const res = ffmpeg({
    MEMFS: fs,
    arguments: args,
    print: (data) => {
      stdOut += data
    }, // It crashes if you don't have this. Tries to call it but it's not defined
    printErr: (data) => {
      stdErr += data
    },
    onExit: () => {},
  })

  const out = res.MEMFS[0]
  if (!out) {
    _onProgress(1, true, true, null, stdOut, stdErr)
    throw new Error("No output", stdOut, stdErr)
  } else {
    const video = new Blob([out.data], { type: 'video/mp4' })
    _onProgress(1, true, true, video, stdOut, stdErr)
    return video
  }
}
