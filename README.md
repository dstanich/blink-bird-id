# blink-bird-id ![Winging It logo](client/public/images/winging-it-32x32.png)

Bird identification software intended on being used in conjunction with this 3d printable bird feeder with Blink camera mount.  The model is available on [Maker World by user Michele](https://makerworld.com/en/models/1239253-smart-bird-feeder-with-integrated-wifi-camera).

This repo is a mix of developer written and AI agent written code as a hobby project to experiment with AI such as GitHub Copilot and Claude.

## Overview

Node.js and Python application to to orchestrate downloading recorded clips from [Blink Smart Security](https://blinkforhome.com), using [blinkpy](https://github.com/fronzbot/blinkpy), then identifying what bird(s) are in the clip.

Frontend written with Next.js intended to be built and exported as a static website.

## Example Deployed Instance

An example of the code running can be found at https://winging-it.org.

Winging-It is being hosted as a static site on AWS and will be updated as improvements are made to the repo.

## Running
### Server

The server is Node.js/Python that is responsible for connecting with Blink's cloud, downloading thumbnails, communicating with AI provider, and storing the results into storage.

#### Setup

**TODO**


### Client

The client is a Next.js application that is statically exported into files then published to a hosting location.  The client code pulls data from the server via the thumbnail download directory and the persistent storage where AI result data is kept.

#### Setup

**TODO**


## TODOs

- [ ] TypeScript
- [ ] Tests
- [ ] Linting
- [ ] Graphing and other nice visualizations

