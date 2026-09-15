import { Device, type types } from 'mediasoup-client';

type Consumer = types.Consumer;
type DtlsParameters = types.DtlsParameters;
type Producer = types.Producer;
type RtpCapabilities = types.RtpCapabilities;
type Transport = types.Transport;
import type { CallTokenResult } from '../../shared/calls';
import { logCallDebug } from '../callDebug';
import { ensureCallMediaPermissions } from '../callsApi';
import { MediaSignalingClient } from './mediaSignalingClient';

export type MediasoupRemotePeer = {
  id: string;
  label: string;
  audioStream: MediaStream | null;
  videoStream: MediaStream | null;
};

type JoinResponse = {
  peerId?: string;
  rtpCapabilities?: RtpCapabilities;
  routerRtpCapabilities?: RtpCapabilities;
  producers?: Array<{ peerId?: string; producerId: string; kind: 'audio' | 'video' }>;
  existingProducers?: Array<{ peerId?: string; producerId: string; kind: 'audio' | 'video' }>;
};

type TransportInfo = {
  id: string;
  iceParameters: types.IceParameters;
  iceCandidates: types.IceCandidate[];
  dtlsParameters: DtlsParameters;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readProducers(payload: JoinResponse | Record<string, unknown> | null | undefined) {
  const record = asRecord(payload);
  const items = record?.producers ?? record?.existingProducers;

  if (!Array.isArray(items)) {
    return [] as Array<{ peerId?: string; producerId: string; kind: 'audio' | 'video' }>;
  }

  const producers: Array<{ peerId?: string; producerId: string; kind: 'audio' | 'video' }> = [];

  for (const item of items) {
    const producer = asRecord(item);

    if (!producer) {
      continue;
    }

    const producerId =
      typeof producer.producerId === 'string'
        ? producer.producerId
        : typeof producer.id === 'string'
          ? producer.id
          : null;
    const kind = producer.kind === 'video' ? 'video' : producer.kind === 'audio' ? 'audio' : null;

    if (!producerId || !kind) {
      continue;
    }

    producers.push({
      peerId: typeof producer.peerId === 'string' ? producer.peerId : undefined,
      producerId,
      kind,
    });
  }

  return producers;
}

export class MediasoupCallSession {
  private readonly client = new MediaSignalingClient();
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private micProducer: Producer | null = null;
  private cameraProducer: Producer | null = null;
  private screenProducer: Producer | null = null;
  private screenStream: MediaStream | null = null;
  private consumers = new Map<string, Consumer>();
  private peers = new Map<string, MediasoupRemotePeer>();
  private localVideoStream: MediaStream | null = null;
  private closed = false;
  private onPeersChanged: (() => void) | null = null;
  private onConnected: (() => void) | null = null;
  private onRoomEnded: (() => void) | null = null;

  static async connect(
    tokenResult: CallTokenResult,
    video: boolean,
    handlers: {
      onConnected?: () => void;
      onPeersChanged?: () => void;
      onRoomEnded?: () => void;
    },
  ): Promise<MediasoupCallSession> {
    const session = new MediasoupCallSession();
    session.onConnected = handlers.onConnected ?? null;
    session.onPeersChanged = handlers.onPeersChanged ?? null;
    session.onRoomEnded = handlers.onRoomEnded ?? null;
    await session.start(tokenResult, video);
    return session;
  }

  getLocalVideoStream(): MediaStream | null {
    return this.localVideoStream;
  }

  getRemotePeers(): MediasoupRemotePeer[] {
    return Array.from(this.peers.values());
  }

  async setMicEnabled(enabled: boolean): Promise<void> {
    if (!this.micProducer) {
      return;
    }

    if (enabled) {
      await this.micProducer.resume();
    } else {
      await this.micProducer.pause();
    }
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (!this.cameraProducer) {
      if (!enabled) {
        return;
      }

      throw new Error('Camera is not available for this call.');
    }

    if (enabled) {
      await this.cameraProducer.resume();
    } else {
      await this.cameraProducer.pause();
    }
  }

  async setScreenShareEnabled(enabled: boolean, stream?: MediaStream): Promise<void> {
    if (!this.sendTransport) {
      throw new Error('Screen sharing is not available for this call.');
    }

    if (!enabled) {
      this.screenProducer?.close();
      this.screenProducer = null;
      this.screenStream?.getTracks().forEach((track) => track.stop());
      this.screenStream = null;

      if (this.cameraProducer) {
        await this.cameraProducer.resume();
      }

      this.notifyPeersChanged();
      return;
    }

    const captureStream = stream ?? null;

    if (!captureStream) {
      throw new Error('Choose a screen or window to share.');
    }

    const track = captureStream.getVideoTracks()[0];

    if (!track) {
      captureStream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      throw new Error('Could not access your screen.');
    }

    track.onended = () => {
      void this.setScreenShareEnabled(false);
    };

    this.screenStream = captureStream;

    if (this.cameraProducer) {
      await this.cameraProducer.pause();
    }

    this.screenProducer = await this.sendTransport.produce({
      track,
      appData: { source: 'screen' },
    });

    this.notifyPeersChanged();
  }

  isScreenShareEnabled(): boolean {
    return Boolean(this.screenProducer);
  }

  getScreenShareStream(): MediaStream | null {
    return this.screenStream;
  }

  async disconnect(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    try {
      await this.client.request('leave', {});
    } catch {
      // Ignore leave failures during teardown.
    }

    this.micProducer?.close();
    this.cameraProducer?.close();
    this.screenProducer?.close();
    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenStream = null;

    for (const consumer of this.consumers.values()) {
      consumer.close();
    }

    this.sendTransport?.close();
    this.recvTransport?.close();
    this.client.close();

    this.localVideoStream?.getTracks().forEach((track) => track.stop());
    this.localVideoStream = null;

    for (const peer of this.peers.values()) {
      peer.audioStream?.getTracks().forEach((track) => track.stop());
      peer.videoStream?.getTracks().forEach((track) => track.stop());
    }

    this.peers.clear();
  }

  private notifyPeersChanged(): void {
    this.onPeersChanged?.();
  }

  private ensurePeer(peerId: string, label?: string): MediasoupRemotePeer {
    const existing = this.peers.get(peerId);

    if (existing) {
      if (label && existing.label === peerId) {
        existing.label = label;
      }

      return existing;
    }

    const peer: MediasoupRemotePeer = {
      id: peerId,
      label: label?.trim() || peerId,
      audioStream: null,
      videoStream: null,
    };

    this.peers.set(peerId, peer);
    return peer;
  }

  private attachTrack(peerId: string, kind: 'audio' | 'video', track: MediaStreamTrack): void {
    const peer = this.ensurePeer(peerId);
    const stream = kind === 'video' ? peer.videoStream ?? new MediaStream() : peer.audioStream ?? new MediaStream();

    stream.getTracks().forEach((existingTrack) => {
      if (existingTrack.kind === track.kind) {
        stream.removeTrack(existingTrack);
        existingTrack.stop();
      }
    });

    stream.addTrack(track);

    if (kind === 'video') {
      peer.videoStream = stream;
    } else {
      peer.audioStream = stream;
    }

    this.notifyPeersChanged();
  }

  private async consumeProducer(producerId: string, peerId?: string, kindHint?: 'audio' | 'video'): Promise<void> {
    if (!this.device || !this.recvTransport) {
      return;
    }

    if (this.consumers.has(producerId)) {
      return;
    }

    const response = await this.client.request<{
      id: string;
      producerId: string;
      kind: 'audio' | 'video';
      rtpParameters: Consumer['rtpParameters'];
    }>('consume', {
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });

    const consumer = await this.recvTransport.consume({
      id: response.id,
      producerId: response.producerId,
      kind: response.kind ?? kindHint ?? 'audio',
      rtpParameters: response.rtpParameters,
    });

    this.consumers.set(producerId, consumer);

    await this.client.request('resumeConsumer', { consumerId: consumer.id });
    await consumer.resume();

    const resolvedPeerId = peerId ?? producerId;
    this.attachTrack(resolvedPeerId, consumer.kind, consumer.track);
  }

  private async createTransport(direction: 'send' | 'recv'): Promise<Transport> {
    if (!this.device) {
      throw new Error('Media device is not ready.');
    }

    const info = await this.client.request<TransportInfo>('createWebRtcTransport', { direction });
    const transport =
      direction === 'send'
        ? this.device.createSendTransport(info)
        : this.device.createRecvTransport(info);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      void this.client
        .request('connectWebRtcTransport', {
          transportId: transport.id,
          dtlsParameters,
        })
        .then(() => callback())
        .catch((error) => errback(error instanceof Error ? error : new Error(String(error))));
    });

    if (direction === 'send') {
      transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
        void this.client
          .request<{ id: string }>('produce', {
            transportId: transport.id,
            kind,
            rtpParameters,
            appData,
          })
          .then((result) => callback({ id: result.id }))
          .catch((error) => errback(error instanceof Error ? error : new Error(String(error))));
      });
    }

    return transport;
  }

  private async start(tokenResult: CallTokenResult, video: boolean): Promise<void> {
    const permissionResult = await ensureCallMediaPermissions(video);

    if (!permissionResult.ok) {
      throw new Error(permissionResult.error);
    }

    logCallDebug('[Calls] Connecting mediasoup', {
      url: tokenResult.url,
      roomName: tokenResult.roomName,
      video,
    });

    await this.client.connect(tokenResult.url);

    this.client.onEvent((event, data) => {
      void this.handleServerEvent(event, data);
    });

    this.client.onClose((code) => {
      if (code === 4000) {
        this.onRoomEnded?.();
      }
    });

    const device = new Device();
    this.device = device;

    const routerCaps =
      (tokenResult.rtpCapabilities as RtpCapabilities | undefined) ??
      undefined;

    if (routerCaps && Object.keys(routerCaps).length > 0) {
      await device.load({ routerRtpCapabilities: routerCaps });
    }

    const joinPayload = {
      token: tokenResult.token,
      rtpCapabilities: device.loaded ? device.rtpCapabilities : {},
    };

    const joinResponse = await this.client.request<JoinResponse>('join', joinPayload);

    if (!device.loaded) {
      const loadedCaps = joinResponse.routerRtpCapabilities ?? joinResponse.rtpCapabilities;

      if (!loadedCaps) {
        throw new Error('Media server did not return RTP capabilities.');
      }

      await device.load({ routerRtpCapabilities: loadedCaps });
    }

    this.sendTransport = await this.createTransport('send');
    this.recvTransport = await this.createTransport('recv');

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    const micTrack = micStream.getAudioTracks()[0];

    if (!micTrack) {
      throw new Error('Could not access your microphone.');
    }

    this.micProducer = await this.sendTransport.produce({
      track: micTrack,
      appData: { source: 'microphone' },
    });

    if (video) {
      const cameraPermission = await ensureCallMediaPermissions(true);

      if (cameraPermission.ok) {
        try {
          this.localVideoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
          const cameraTrack = this.localVideoStream.getVideoTracks()[0];

          if (cameraTrack) {
            this.cameraProducer = await this.sendTransport.produce({
              track: cameraTrack,
              appData: { source: 'camera' },
            });
          }
        } catch (error) {
          logCallDebug(
            '[Calls] Camera unavailable for mediasoup, continuing voice-only',
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    for (const producerItem of readProducers(joinResponse)) {
      await this.consumeProducer(
        producerItem.producerId,
        producerItem.peerId,
        producerItem.kind,
      );
    }

    this.onConnected?.();
  }

  private async handleServerEvent(event: string, data: unknown): Promise<void> {
    const record = asRecord(data);

    if (event === 'new-producer' && record) {
      const producerId =
        typeof record.producerId === 'string'
          ? record.producerId
          : typeof record.id === 'string'
            ? record.id
            : null;
      const peerId = typeof record.peerId === 'string' ? record.peerId : undefined;
      const kind = record.kind === 'video' ? 'video' : record.kind === 'audio' ? 'audio' : undefined;

      if (producerId) {
        await this.consumeProducer(producerId, peerId, kind);
      }

      return;
    }

    if (event === 'peer-joined' && record) {
      const peerId = typeof record.peerId === 'string' ? record.peerId : typeof record.id === 'string' ? record.id : null;
      const label =
        typeof record.username === 'string'
          ? record.username
          : typeof record.displayName === 'string'
            ? record.displayName
            : undefined;

      if (peerId) {
        this.ensurePeer(peerId, label);
        this.notifyPeersChanged();
      }

      return;
    }

    if (event === 'peer-left' && record) {
      const peerId = typeof record.peerId === 'string' ? record.peerId : typeof record.id === 'string' ? record.id : null;

      if (peerId) {
        const peer = this.peers.get(peerId);

        peer?.audioStream?.getTracks().forEach((track) => track.stop());
        peer?.videoStream?.getTracks().forEach((track) => track.stop());
        this.peers.delete(peerId);
        this.notifyPeersChanged();
      }

      return;
    }

    if (event === 'room-ended') {
      this.onRoomEnded?.();
    }
  }
}
