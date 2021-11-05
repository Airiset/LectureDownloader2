import React, { useState, useCallback, useEffect, useMemo } from 'react'

import { Container, Row, Col, ProgressBar, Button } from 'react-bootstrap'

import './app.css'

function useDownloader () {
  const [sources, setSources] = useState({})
  const [pingPort, setPingPort] = useState()
  const [alive, setAlive] = useState(false)

  // Set up communication with the background script
  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'ping' })
    setPingPort(port)
    const handler = message => {
      if (message.type === 'PONG') {
        setAlive(true)
      }
    }
    port.onMessage.addListener(handler)
    port.postMessage({ type: 'PING' })

    port.onDisconnect.addListener(() => {
      setAlive(false)
    })

    return () => port.onMessage.removeEventListener(handler)
  }, [setPingPort, setAlive])

  // We also need to create a listener that can react to the backend saying it has a new source
  const addSource = useCallback((port, m3u8URL) => {
    console.log("Adding source:", port, m3u8URL)
    const newSource = {
      downloadProgress: 0, downloadDone: false, concatDone: false,
      port, m3u8URL
    }
    if (!sources[m3u8URL]) {
      setSources(sources => ({ ...sources, [m3u8URL]: newSource }))
    }

    // Whenever we get a message on the port of type: "PROGRESS", want to update these values
    port.onMessage.addListener(message => {
      if (message.type === 'PROGRESS') {
        const { downloadProgress, downloadDone, concatDone } = message
        setSources(sources => ({ ...sources, [m3u8URL]: { ...sources[m3u8URL], downloadProgress, downloadDone, concatDone } }))
      }
    })

    // When the port disconnects, we want to remove the source from the list
    port.onDisconnect.addListener(() => {
      setSources(sources => {
        const newSources = { ...sources }
        delete newSources[m3u8URL]
        return newSources
      })
    })
  }, [setSources, sources])

  useEffect(() => {
    const handler = port => {
      console.log("Background opened a port", port, port.name, port.name.split(":=+=:"))
      if (port.name.split(':=+=:')[0] === "PROGRESS") {
        const m3u8URL = port.name.split(":=+=:")[1]
        console.log("Progress port opened:", port)
        addSource(port, m3u8URL)
      }
    }
    chrome.runtime.onConnect.addListener(handler)
    return () => chrome.runtime.onConnect.removeListener(handler)
  }, [addSource])

  return {
    sources, alive
  }
}

export default function App () {
  const { sources, alive } = useDownloader()

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'RECONNECT' })
    // setTimeout(() => {
    //   // Send a message to the background script with a payload of { type: "START_DOWNLOAD" }
    //   chrome.runtime.sendMessage({ type: "START_DOWNLOAD", m3u8URL: "https://stream.library.utoronto.ca:1935/MyMedia/play/mp4:1/a90733f851fddeae5ca490319d2effdc.mp4/chunklist_w1683327371.m3u8" })
    // }, 2000)
  }, [])

  useEffect(() => {
    console.log("Sources changed", sources)
  }, [sources])

  const rows = useMemo(() => Object.values(sources).map(({ downloadProgress, downloadDone, m3u8URL }) => <Row key={m3u8URL} className='progressRow'>
    <Col xs={2} className='progressId'>Title Unknown</Col>
    <Col className='progressBar'><ProgressBar now={downloadProgress*100} variant={downloadDone ? 'success' : 'info'} /></Col>
  </Row>), [sources])

  return (
    <div className="mainContainer">
      <h1>Lecture Downloader</h1>
      <p>
        Welcome to lecture downloader 2.0! Now with 100% less destroying my bank account! <i>Seriously though it was pretty bad...</i>
      </p>
      <p>
        Anyway, that's all done now because now we are in the future and I can run c code in the browser. I was able to build a small
        version of FFmpeg that has the sole capability of converting m3u8 streams into mp4s. That means I can have your computer do all
        the hard work instead of my server and it also means I don't have to store videos anywhere (Yay I'm not committing IP fraud
        anymore). Since your computer is doing the work now, it might take a bit longer to download long videos which sucks, but it
        also means that server crashes won't happen and this extension has 100% uptime so that's good.
      </p>
      <p>
        Also, you don't even have to remain on the page once you've clicked download. As long as chrome is still open, the download will continue.
      </p>
      <p>
        Thank you so much to everyone who donated to keep this alive over the last few months. This extension would have disappeared
        by the end of the summer if it wasn't for you. Now if you donate, it goes to supporting my ability to buy groceries. Who am I
        kidding it will probably go to more server time cause I'm a GPU slut.
        <br/>
        <Button onClick={() => window.open('https://www.paypal.com/donate?business=BD3LVZYUJ3B8W&item_name=To+fund+the+storage+necessary+to+allow+UofT+students+to+download+their+lectures.&currency_code=CAD')}>Donate!</Button>
      </p>
      <p>
        I'll probably make this popup look better in the future, but I'm just interested in getting this out right now so I can stop paying
        for storage space.
      </p>
      <Container fluid>
        {
          rows
        }
      </Container>
    </div>
  )
}
