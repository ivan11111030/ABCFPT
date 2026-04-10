# ABCF Production Team Architecture

## Overview

ABCF Production Team is a unified worship production platform built with:
- Frontend: React + Next.js App Router
- Realtime Sync: Socket.io over WebSockets
- Streaming: WebRTC for mobile camera input, architecture-ready RTMP support for Facebook Live
- Data: SQL-compatible schema for songs, setlists, cameras, and audio sources
- Deployment: Next.js app served as web and PWA, with a separate Node-based socket server for real-time events

## System Components

1. **Main Web App** (`app/`)
   - `/control`: Production control dashboard
   - `/projector`: Congregation lyrics display
   - `/teleprompter`: Singer teleprompter view
   - `/mobile-camera`: Mobile phone camera connection page
   - `/songs`: Song management interface

2. **Realtime Engine** (`server/index.ts`)
   - Socket server for device sync, slide control, camera switching, mobile WebRTC signaling, and audio events
   - Emits shared state changes to all connected devices

3. **Component Library** (`src/components/`)
   - Shared UI sections: livestream studio, setlist, camera preview, teleprompter controls, audio monitor
   - Designed for volunteer-friendly interaction and quick service operation

4. **Data Models** (`src/types/production.ts`)
   - Core domain types for songs, slides, cameras, audio sources, and streaming metadata

5. **Database Schema** (`db/schema.sql`)
   - Defines normalized tables for songs, slides, setlists, users, audio sources, cameras, and scriptures

## Realtime Collaboration Flow

- Production operator triggers slide or camera changes on `/control`
- Socket server broadcasts events to connected devices
- Projector view updates lyrics slides instantly
- Teleprompter devices follow slide changes in real time
- Mobile cameras stream directly into the production camera roster via WebRTC signaling

## Camera Integration

- Supports network camera protocols:
  - RTSP
  - NDI
  - ONVIF
  - WebRTC
- Includes support for smartphone cameras over WiFi
- Supports manual camera entry and discovery workflows
- Includes PTZ-ready metadata and preset support in the camera model

## PWA and Multiplatform Support

- Uses standard web manifest to enable desktop/laptop install and tablet-optimized operation
- Design follows a modern broadcast tool aesthetic with large readable typography and responsive grids

## Folder Structure

- `app/`: Next.js pages and route components
- `src/components/`: Reusable interface modules
- `src/lib/`: Client runtime helpers and sync engine
- `src/types/`: Shared TypeScript domain models
- `server/`: Socket server and event handling
- `db/`: Base schema for production data
- `public/`: Static assets and PWA manifest

## Notes

- The current implementation is a functional scaffold and a production-ready starting point.
- Additional backend persistence, authentication, and RTMP encoder integration can be layered without changing the core realtime architecture.
