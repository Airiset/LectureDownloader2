### Lecture Downloader 2.0

This is the repository so unless you want to dig though code you should probably be [here](https://chrome.google.com/webstore/detail/ndnkcmibkplamecekdhikoadjamfcpfk?authuser=2&hl=en).

Ok so if you're still here by choice, let's get into how this works (Or if you're interested in just building this yourself for whatever reason look at the link at the bottom).
The fact that you can see a video on the internet means that you can download it. Sometimes it's not easy, but you can always do it. In this case, UofT serves us a `.m3u8` file that is common for streamed video. This basically just links to a bunch of shorter videos encoded with `MPEG2` which means that they can just be concatenated to form the longer video. In this case specifically, they are using h.264 to encode the video and acc for the audio. These videos are tagged with the filename `.ts` for transport-stream which basically just marks these as videos for streaming. You can just rename them to `.mpeg` and it will work since that's what they really are.

Now, we need some way to convert these videos from a bunch of `.ts` files to one `.mp4` file. The easiest way to do that is using the `ffmpeg -i concat:file1.ts|file2.ts|... -c copy out.mp4` command. Unfortunatly, there is no such thing as `ffmpeg` on the web... or is there? Of course there is. You just need to build a webassembly version of [ffmpeg](https://www.ffmpeg.org/). Lucky for me somebody already did it and it's on github as [ffmpeg.js](https://github.com/Kagami/ffmpeg.js) (There's other ones but they're actually broken atm due to web security issues). Sounds good, here's where the nightmare begins.

I am not an expert in ffmpeg. I am not an expert in video conversion language. I am not an expert in compiling c programs. I am 100% not an expert in web assembly. And ffmpeg.js is built to by as minimal as possible to keep the file size low. That means it has the dreaded `--disable-all` flag set for the build configuration. I needed to figure out exactly which `--enable-xxx` flags to set to get it to work with converting `.ts` to `.mp4`. Except, what does it mean to "convert" a file? Turns out, a bunch of different stuff. What I wanted was to remux the files since the encoding was the same on both ends (no rencoding needed). So that means I needed to enable the `mpegts` demuxer. How did I figure out that specific name of the demuxer? I just tried every demuxer I saw that had mpeg in it until it worked.

But that's not the end, oh no is that not the end. Next, I needed to enable two parsers, `h.264` and `.acc`. I'm still not sure what parsers do but whatever. Then I needed to enable the binary stream filter for conversion between the file types with `--enable-bsf=aac_adtstoasc` oh and also enabling the `concat` protocol. And all of this info I found through 6 year old forum posts and sheer luck.

So, yea. That's the basis of how the video converion works. The rest is pretty normal chrome extension stuff that I will probably still understand in the future and I'm the only one who's going to be looking at this README so whatever.

---

This project was bootstrapped with [Chrome Extension CLI](https://github.com/dutiyesh/chrome-extension-cli)

