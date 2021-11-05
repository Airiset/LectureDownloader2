'use strict';

import downloadM3U8 from './video.js'

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

chrome.runtime.onConnect.addListener(function(port) {
  console.log("Port opened", port)
  if (port.name === "ping") {
    port.onMessage.addListener(msg => {
      console.log("Ping recieved message", msg)
      if (msg.type === "PING") {
        console.log("Sending pong")
        port.postMessage({ type: "PONG" })
      }
    })

    port.onDisconnect.addListener(() => {
      console.log("Ping port closed")
    })
  }
})

const downloadingVideos = {}  // Keys are the m3u8URL and values are { downloadProgress, downloadDone, concatDone, video, port }
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Got a request:", request)
  // This listens for requests to start a new download or to set up port connections for the downloading videos

  const openProgressConnection = (m3u8URL, tab=null) => {
    // Opens a port to the popup and contentScripts for the given m3u8URL
    // Progress info comes directly from the downloadingVideos object with the m3u8URL as the key
    console.log("Opening port to the frontend for progress:", m3u8URL)
    let port = chrome.extension.connect({ name: `PROGRESS:=+=:${m3u8URL}` })
    downloadingVideos[m3u8URL].port = port

    // If a tab has been specified, we also want to send updates to that tab
    let tabPort = null
    if (tab) {
      tabPort = chrome.tabs.connect(tab.id, { name: `PROGRESS:=+=:${m3u8URL}` })
    }
    const update = () => {
      const message = {
        type: "PROGRESS",
        m3u8URL: m3u8URL,
        downloadProgress: downloadingVideos[m3u8URL].downloadProgress,
        downloadDone: downloadingVideos[m3u8URL].downloadDone,
        concatDone: downloadingVideos[m3u8URL].concatDone
      }
      if (downloadingVideos[m3u8URL].port) {
        // Prevents us from sending to a disconnected port
        downloadingVideos[m3u8URL].port.postMessage(message)
      }
      if (tabPort) {
        tabPort.postMessage(message)
      }
    }

    port.onDisconnect.addListener(() => {
      console.log("Progress port closed:", m3u8URL, port)
      // We clear the port from the object
      downloadingVideos[m3u8URL].port = null
    })

    if (tabPort) {
      tabPort.onDisconnect.addListener(() => {
        console.log("Tab port closed:", m3u8URL, tabPort)
        tabPort = null
      })
    }
    update()
    return update
  }

  if (request.type === "START_DOWNLOAD") {
    // The request.payload should be an obejct with a type="START_DOWNLOAD" and a m3u8URL property
    const { m3u8URL } = request
    if (!downloadingVideos[m3u8URL]) {
      downloadingVideos[m3u8URL] = {
        downloadProgress: 0,
        downloadDone: false,
        concatDone: false,
        video: null,
        port: null
      }
    }
    console.log("Got request to download", m3u8URL)
    if (!downloadingVideos[m3u8URL] || downloadingVideos[m3u8URL].port == null) {
      const forceUpdate = openProgressConnection(m3u8URL, sender.tab)
      // We start downloading the video. Once the download is complete, we download the video, force an update, disconnect the port, and then delete the obejct from downloadingVideos
      downloadM3U8(m3u8URL, {
        lengthRestriction: -1,
        onProgress: ({ downloadProgress, downloadDone, concatDone, video }) => {
          downloadingVideos[m3u8URL].downloadProgress = downloadProgress
          downloadingVideos[m3u8URL].downloadDone = downloadDone
          downloadingVideos[m3u8URL].concatDone = concatDone
          downloadingVideos[m3u8URL].video = video
          forceUpdate()

          if (concatDone && video) {
            chrome.downloads.download({
              url: URL.createObjectURL(video),
              filename: "lecture.mp4"
            })
            console.log("Video download finished")
            if (downloadingVideos[m3u8URL].port) {
              downloadingVideos[m3u8URL].port.disconnect()
            }
            delete downloadingVideos[m3u8URL]
          } else if (concatDone && !video) {
            // Then we hit an error
            console.log("Video failed to download")
            if (downloadingVideos[m3u8URL].port) {
              downloadingVideos[m3u8URL].port.disconnect()
            }
            delete downloadingVideos[m3u8URL]
          }
        }
      })
    }
  } else if (request.type = "RECONNECT") {
    // This means the popup was opened and is requesting port connections to udpate it with the download progress
    // One port should be opened per downloading video
    console.log("Popup requesting reconnect")
    for (const m3u8URL of Object.keys(downloadingVideos)) {
      openProgressConnection(m3u8URL)
    }
  }
})
