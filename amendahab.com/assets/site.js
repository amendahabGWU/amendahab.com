(() => {
  'use strict';

  const rootEl = document.documentElement;
  const mqReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const hwThreads = navigator.hardwareConcurrency || 4;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const isSmallScreen = window.screen && (window.screen.width < 768 || window.screen.height < 768);
  const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isCompactTouch = isTouchOnly && isSmallScreen;

  let reducedMotion = mqReducedMotion.matches;
  let lowPower = reducedMotion || hwThreads <= 4 || saveData || (isTouchOnly && isSmallScreen);
  let activeMotionHandler = null;
  let currentPageCleanup = () => {};
  let navigationToken = 0;

  const fontsReadyPromise = document.fonts && document.fonts.ready
    ? document.fonts.ready.catch(() => undefined)
    : Promise.resolve();

  function syncLiteModeClass() {
    rootEl.classList.toggle('is-lite', lowPower || reducedMotion);
  }

  function handleReducedMotionChange(event) {
    reducedMotion = event.matches;
    lowPower = reducedMotion || hwThreads <= 4 || saveData || (isTouchOnly && isSmallScreen);
    syncLiteModeClass();
    if (typeof activeMotionHandler === 'function') {
      activeMotionHandler(event.matches);
    }
  }

  syncLiteModeClass();

  if (typeof mqReducedMotion.addEventListener === 'function') {
    mqReducedMotion.addEventListener('change', handleReducedMotionChange);
  } else if (typeof mqReducedMotion.addListener === 'function') {
    mqReducedMotion.addListener(handleReducedMotionChange);
  }

  const masthead = document.querySelector('.masthead');
  const footer = document.querySelector('.footer');
  const audioDockShell = document.getElementById('audioDock');

  function syncHeaderChrome() {
    if (!masthead) return;
    const headerHeight = Math.ceil(masthead.getBoundingClientRect().height);
    rootEl.style.setProperty('--header-reserve', `${headerHeight}px`);
  }

  function syncFooterChrome() {
    if (!footer) return;

    const vv = window.visualViewport;
    const layoutViewportHeight = document.documentElement.clientHeight;
    const bottomOffset = (isCompactTouch && vv)
      ? Math.max(0, layoutViewportHeight - (vv.height + vv.offsetTop))
      : 0;
    const footerHeight = Math.ceil(footer.getBoundingClientRect().height + 10);

    rootEl.style.setProperty('--footer-offset', `${Math.round(bottomOffset)}px`);
    rootEl.style.setProperty('--footer-reserve', `${footerHeight}px`);
  }

  function syncPlayerChrome() {
    const playerHeight = audioDockShell ? Math.ceil(audioDockShell.getBoundingClientRect().height) : 0;
    rootEl.style.setProperty('--player-reserve', `${playerHeight}px`);
  }

  let chromeSyncFrame = 0;
  function scheduleChromeSync() {
    if (chromeSyncFrame) return;
    chromeSyncFrame = requestAnimationFrame(() => {
      chromeSyncFrame = 0;
      syncHeaderChrome();
      syncFooterChrome();
      syncPlayerChrome();
    });
  }

  window.addEventListener('load', scheduleChromeSync);
  window.addEventListener('resize', scheduleChromeSync);
  window.addEventListener('orientationchange', scheduleChromeSync);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleChromeSync);
    window.visualViewport.addEventListener('scroll', scheduleChromeSync);
  }

  const AUDIO_PLAYLIST = [
    {
      src: 'media/without-fear-of-wind.mp3',
      title: 'Without Fear of Wind',
      titleUrl: 'https://amendahab.bandcamp.com/track/without-fear-of-wind',
      artist: 'AMEN',
      artistUrl: 'https://open.spotify.com/artist/2WB58OxKhr8iAK030gw3cB?si=UnBD0_N4TYylXUge_d0DgQ',
      artwork: 'media/finalwedding.jpg',
      album: 'Without Fear of Wind',
      stamp: 'Current Release',
      embedUrl: 'https://open.spotify.com/embed/track/26YH77kEs232A02Q166fDb?utm_source=generator',
    },
    {
      src: 'media/addy-jonah-green-star.mp3',
      title: 'Green Star',
      artist: 'Addy + Jonah',
      album: 'Greenstar',
      artwork: 'media/addy-jonah-greenstar-cover.jpg',
    },
    {
      src: 'media/addy-jonah-reset.m4a',
      title: 'Reset',
      artist: 'Addy + Jonah',
      album: 'Exit',
      artwork: 'media/addy-jonah-exit-cover.jpg',
    },
    {
      src: 'media/black-noise-elevator-music.m4a',
      title: 'Elevator Music',
      artist: 'Black Noi$e',
      artwork: 'media/black-noise-elevator-music-cover.jpg',
    },
    {
      src: 'media/cristian-anonymous-riddim.mp3',
      title: 'Anonymous Riddim',
      artist: 'Cristian (Patch+)',
      artwork: 'media/cristian-artwork.jpg',
    },
    {
      src: 'media/jam0600-jamfm-23.m4a',
      title: 'jamFM #23',
      artist: 'JAM0600',
      artwork: 'media/jam0600-artwork.png',
    },
    {
      src: 'media/karim-wfow-mix.m4a',
      title: 'WFOW Mix',
      artist: 'Karim Abdel-Wadood',
      artwork: 'media/karim-wfow-tracklist.png',
    },
    {
      src: 'media/kissmybass-mix.m4a',
      title: 'KI$$MYBA$$ Mix',
      artist: 'Ki$$MYBA$$',
      artwork: 'media/kissmybass-artwork.png',
    },
    {
      src: 'media/zachary-paul-fear.mp3',
      title: 'Fear',
      artist: 'Zachary Paul',
      album: 'Calandar',
      artwork: 'media/zachary-paul-calandar-cover.jpg',
    },
    {
      src: 'media/zachary-paul-red-blood.mp3',
      title: 'Red Blood Full Measure',
      artist: 'Zachary Paul',
      album: 'Calandar',
      artwork: 'media/zachary-paul-calandar-cover.jpg',
    },
  ];

  class AmenAudioPlayer {
    constructor(dockEl, playlist) {
      this.dockEl = dockEl;
      this.playlist = Array.isArray(playlist)
        ? playlist.filter((item) => item && typeof item.src === 'string' && item.src.trim())
        : [];
      this.queue = [];
      this.queueIndex = 0;
      this.listeners = new Set();

      this.audioEl = document.getElementById('audioPlayer');
      this.artworkEl = document.getElementById('audioCover');
      this.titleLinkEl = document.getElementById('audioTitleLink');
      this.metaPrefixEl = document.getElementById('audioMetaPrefix');
      this.artistLinkEl = document.getElementById('audioArtistLink');
      this.statusEl = document.getElementById('audioStatus');
      this.toggleButton = document.getElementById('audioToggle');
      this.stepButton = document.getElementById('audioStep');
      this.skipPrevButton = document.getElementById('audioSkipPrev');
      this.skipNextButton = document.getElementById('audioSkipNext');
      this.queueToggleButton = document.getElementById('audioQueueToggle');
      this.queueCloseButton = document.getElementById('audioQueueClose');
      this.queuePopEl = document.getElementById('audioQueuePop');
      this.queueListEl = document.getElementById('audioQueueList');
      this.coverWrapEl = this.artworkEl ? this.artworkEl.closest('.audio-cover-wrap') : null;
      this.lightboxEl = null;
      this.lightboxImageEl = null;
    }

    ensureCoverLightbox() {
      if (this.lightboxEl) return;

      const lightbox = document.createElement('div');
      lightbox.className = 'cover-lightbox';
      lightbox.id = 'coverLightbox';
      lightbox.hidden = true;
      lightbox.setAttribute('role', 'dialog');
      lightbox.setAttribute('aria-modal', 'true');
      lightbox.setAttribute('aria-label', 'Artwork');

      const backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.className = 'cover-lightbox-backdrop';
      backdrop.setAttribute('aria-label', 'Close artwork');
      backdrop.addEventListener('click', () => this.setCoverLightboxOpen(false));

      const figure = document.createElement('figure');
      figure.className = 'cover-lightbox-figure';

      const img = document.createElement('img');
      img.className = 'cover-lightbox-image';
      img.alt = '';
      figure.appendChild(img);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'cover-lightbox-close';
      closeBtn.setAttribute('aria-label', 'Close artwork');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => this.setCoverLightboxOpen(false));
      figure.appendChild(closeBtn);

      lightbox.append(backdrop, figure);
      document.body.appendChild(lightbox);

      this.lightboxEl = lightbox;
      this.lightboxImageEl = img;

      this.escHandler = (event) => {
        if (event.key === 'Escape' && !this.lightboxEl.hidden) {
          this.setCoverLightboxOpen(false);
        }
      };
    }

    setCoverLightboxOpen(isOpen) {
      this.ensureCoverLightbox();
      if (!this.lightboxEl) return;

      if (isOpen) {
        const item = this.getCurrentItem();
        if (!item) return;
        this.lightboxImageEl.src = item.artwork || 'media/finalwedding.jpg';
        this.lightboxImageEl.alt = item.title ? `${item.title} artwork` : 'Artwork';
        this.lightboxEl.hidden = false;
        document.documentElement.dataset.coverLightbox = 'open';
        document.addEventListener('keydown', this.escHandler);
        requestAnimationFrame(() => {
          this.lightboxEl.dataset.state = 'open';
        });
      } else {
        this.lightboxEl.dataset.state = 'closed';
        document.removeEventListener('keydown', this.escHandler);
        delete document.documentElement.dataset.coverLightbox;
        setTimeout(() => {
          if (this.lightboxEl.dataset.state === 'closed') {
            this.lightboxEl.hidden = true;
          }
        }, 220);
      }
    }

    toggleCoverLightbox() {
      this.setCoverLightboxOpen(!this.lightboxEl || this.lightboxEl.hidden);
    }

    shuffleIndices(length) {
      const indices = Array.from({ length }, (_, index) => index);
      for (let index = indices.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
      }
      return indices;
    }

    buildInitialQueue() {
      return this.shuffleIndices(this.playlist.length);
    }

    getCurrentIndex() {
      const itemIndex = this.queue[this.queueIndex];
      return typeof itemIndex === 'number' ? itemIndex : -1;
    }

    getCurrentItem() {
      const itemIndex = this.getCurrentIndex();
      return itemIndex >= 0 ? this.playlist[itemIndex] : null;
    }

    getActivePlaybackState() {
      return !!this.audioEl.src && !this.audioEl.paused && !this.audioEl.ended;
    }

    getSnapshot() {
      return {
        playlist: this.getPlaylist(),
        queue: this.getQueue(),
        queueIndex: this.queueIndex,
        currentIndex: this.getCurrentIndex(),
        currentItem: this.getCurrentItem(),
        isPlaying: this.getActivePlaybackState(),
        collapsed: this.dockEl ? this.dockEl.dataset.collapsed === 'true' : false,
      };
    }

    getPlaylist() {
      return this.playlist.slice();
    }

    getQueue() {
      return this.queue.slice();
    }

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      this.listeners.add(listener);
      listener(this.getSnapshot());
      return () => {
        this.listeners.delete(listener);
      };
    }

    notify() {
      const snapshot = this.getSnapshot();
      if (this.queuePopEl && !this.queuePopEl.hidden) {
        this.renderQueuePop();
      }
      this.listeners.forEach((listener) => {
        listener(snapshot);
      });
    }

    syncPlaybackUI(isPlaying) {
      this.dockEl.dataset.state = isPlaying ? 'playing' : 'paused';
      this.toggleButton.setAttribute('aria-pressed', String(isPlaying));
      this.toggleButton.setAttribute('aria-label', isPlaying ? 'Pause current track' : 'Play current track');
      this.notify();
    }

    syncCollapseUI(isCollapsed) {
      this.dockEl.dataset.collapsed = isCollapsed ? 'true' : 'false';
      this.stepButton.textContent = isCollapsed ? '+' : '-';
      this.stepButton.setAttribute('aria-label', isCollapsed ? 'Expand player' : 'Collapse player');
      syncPlayerChrome();
      this.notify();
    }

    disableControls(disabled) {
      this.toggleButton.disabled = disabled;
    }

    resetAudio() {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
      this.syncPlaybackUI(false);
    }

    setLinkedText(element, text, url) {
      element.textContent = text;

      if (url && typeof url === 'string' && url.trim()) {
        element.href = url.trim();
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
        element.dataset.linked = 'true';
        element.removeAttribute('tabindex');
        return;
      }

      element.removeAttribute('href');
      element.removeAttribute('target');
      element.removeAttribute('rel');
      element.dataset.linked = 'false';
      element.setAttribute('tabindex', '-1');
    }

    setCopy(item, visibleIndex) {
      const artist = item.artist ? item.artist.toUpperCase() : 'AMEN';
      const title = (item.title || 'Untitled').toUpperCase();
      const label = item.stamp || item.album || '';
      const suffix = label ? ` · ${label.toUpperCase()}` : '';

      this.setLinkedText(this.titleLinkEl, title, item.titleUrl);
      this.setLinkedText(this.artistLinkEl, artist, item.artistUrl);
      this.metaPrefixEl.textContent = suffix;
      this.artworkEl.src = item.artwork || 'media/finalwedding.jpg';
      this.artworkEl.alt = item.title ? `${item.title} artwork` : '';
      if (this.lightboxEl && !this.lightboxEl.hidden && this.lightboxImageEl) {
        this.lightboxImageEl.src = item.artwork || 'media/finalwedding.jpg';
        this.lightboxImageEl.alt = item.title ? `${item.title} artwork` : 'Artwork';
      }
      this.statusEl.textContent = `Queued ${item.title || 'Untitled'} by ${artist}.`;
      this.notify();
    }

    async maybeAutoplay() {
      try {
        await this.audioEl.play();
        this.statusEl.textContent = this.queue.length > 1
          ? 'Playback live. Queue auto-advances.'
          : 'Playback live. Placeholder track active.';
      } catch (error) {
        this.syncPlaybackUI(false);
        this.statusEl.textContent = this.queue.length > 1
          ? 'Queue loaded. Press play to begin.'
          : 'Placeholder loaded. Press play to begin.';
      }
      this.notify();
    }

    loadCurrentItem({ autoplay = false } = {}) {
      const item = this.getCurrentItem();
      if (!item) return;

      this.resetAudio();
      this.setCopy(item, this.queueIndex + 1);
      this.dockEl.dataset.mode = 'ready';
      this.audioEl.src = item.src;
      this.audioEl.load();

      if (autoplay) {
        this.maybeAutoplay();
        return;
      }

      this.statusEl.textContent = this.queue.length > 1
        ? 'Queue loaded. Press play to begin.'
        : 'Placeholder loaded. Press play.';
      this.notify();
    }

    goToQueuePos(nextIndex, { autoplay = false } = {}) {
      this.queueIndex = nextIndex;
      this.loadCurrentItem({ autoplay });
    }

    goToNext({ autoplay = this.getActivePlaybackState() } = {}) {
      if (!this.queue.length) return;
      const nextIndex = (this.queueIndex + 1) % this.queue.length;
      this.goToQueuePos(nextIndex, { autoplay });
    }

    goToPrev({ autoplay = this.getActivePlaybackState() } = {}) {
      if (!this.queue.length) return;

      if (this.audioEl.currentTime > 3 && this.queue.length > 1) {
        this.audioEl.currentTime = 0;
        return;
      }

      const prevIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
      this.goToQueuePos(prevIndex, { autoplay });
    }

    playTrackAt(trackIndex, { autoplay = true } = {}) {
      if (!Number.isInteger(trackIndex) || !this.playlist[trackIndex]) return;
      const queuePos = this.queue.indexOf(trackIndex);
      if (queuePos === -1) return;
      this.goToQueuePos(queuePos, { autoplay });
    }

    reorderQueue(fromPos, toPos) {
      if (!Number.isInteger(fromPos) || !Number.isInteger(toPos)) return;
      if (fromPos === toPos) return;
      if (fromPos < 0 || fromPos >= this.queue.length) return;
      if (toPos < 0 || toPos > this.queue.length) return;

      const currentTrack = this.queue[this.queueIndex];
      const [moved] = this.queue.splice(fromPos, 1);
      const insertAt = fromPos < toPos ? toPos - 1 : toPos;
      this.queue.splice(insertAt, 0, moved);
      this.queueIndex = Math.max(0, this.queue.indexOf(currentTrack));
      this.notify();
    }

    moveInQueue(trackIndex, position) {
      if (!Number.isInteger(trackIndex) || !this.playlist[trackIndex]) return;
      if (position !== 'next' && position !== 'last') return;

      const currentTrackIndex = this.queue[this.queueIndex];
      if (trackIndex === currentTrackIndex) return;

      const fromPos = this.queue.indexOf(trackIndex);

      if (fromPos !== -1) {
        this.queue.splice(fromPos, 1);
      }

      if (position === 'next') {
        const anchor = this.queue.indexOf(currentTrackIndex);
        const insertAt = anchor === -1 ? 0 : anchor + 1;
        this.queue.splice(insertAt, 0, trackIndex);
      } else {
        this.queue.push(trackIndex);
      }

      this.queueIndex = Math.max(0, this.queue.indexOf(currentTrackIndex));
      this.notify();
    }

    togglePlayback() {
      if (!this.playlist.length) return;

      if (!this.audioEl.src) {
        this.loadCurrentItem();
      }

      if (this.audioEl.paused || this.audioEl.ended) {
        this.audioEl.play().catch(() => {
          this.syncPlaybackUI(false);
          this.statusEl.textContent = 'Playback could not start.';
          this.notify();
        });
        return;
      }

      this.audioEl.pause();
    }

    toggleCollapsed() {
      this.syncCollapseUI(this.dockEl.dataset.collapsed !== 'true');
    }

    setQueuePopOpen(isOpen) {
      if (!this.queuePopEl) return;
      this.queuePopEl.hidden = !isOpen;
      this.dockEl.dataset.queuePop = isOpen ? 'open' : 'closed';
      this.queueToggleButton?.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) this.renderQueuePop();
      this.notify();
    }

    toggleQueuePop() {
      if (!this.queuePopEl) return;
      this.setQueuePopOpen(this.queuePopEl.hidden);
    }

    renderQueuePop() {
      if (!this.queueListEl) return;
      this.queueListEl.textContent = '';

      const len = this.queue.length;
      if (!len) return;
      const start = Math.max(0, this.queueIndex);
      const maxVisible = Math.min(3, len);

      for (let offset = 0; offset < maxVisible; offset += 1) {
        const position = (start + offset) % len;
        const trackIndex = this.queue[position];
        const item = this.playlist[trackIndex];
        if (!item) continue;

        const entry = document.createElement('li');
        entry.className = 'audio-queue-pop-row';
        entry.dataset.active = position === this.queueIndex ? 'true' : 'false';
        entry.dataset.queuePosition = String(position);
        entry.draggable = true;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'audio-queue-pop-button';
        button.dataset.popPlayIndex = String(trackIndex);

        const markerEl = document.createElement('span');
        markerEl.className = 'audio-queue-pop-num';
        markerEl.setAttribute('aria-hidden', 'true');
        markerEl.textContent = position === this.queueIndex ? '▸' : '';

        const metaEl = document.createElement('span');
        metaEl.className = 'audio-queue-pop-meta';

        const titleEl = document.createElement('span');
        titleEl.className = 'audio-queue-pop-title';
        titleEl.textContent = item.title || 'Untitled';

        const contextEl = document.createElement('span');
        contextEl.className = 'audio-queue-pop-artist';
        const contextBits = [item.artist || 'AMEN'];
        if (item.album) contextBits.push(item.album);
        contextEl.textContent = contextBits.join(' · ');

        metaEl.append(titleEl, contextEl);
        button.append(markerEl, metaEl);
        entry.appendChild(button);
        this.queueListEl.appendChild(entry);
      }
    }

    initEmptyState() {
      this.dockEl.dataset.mode = 'empty';
      this.dockEl.dataset.state = 'paused';
      this.setLinkedText(this.titleLinkEl, 'Transmission deck ready', '');
      this.setLinkedText(this.artistLinkEl, 'Playlist empty', '');
      this.metaPrefixEl.textContent = '';
      this.artworkEl.src = 'media/finalwedding.jpg';
      this.artworkEl.alt = '';
      this.statusEl.textContent = 'Audio player ready for playlist items.';
      this.resetAudio();
      this.syncCollapseUI(false);
      this.disableControls(true);
      this.notify();
    }

    bindEvents() {
      this.toggleButton.addEventListener('click', () => {
        this.togglePlayback();
      });

      this.stepButton.addEventListener('click', () => {
        this.toggleCollapsed();
      });

      this.skipPrevButton?.addEventListener('click', () => {
        this.goToPrev({ autoplay: this.getActivePlaybackState() });
      });

      this.skipNextButton?.addEventListener('click', () => {
        this.goToNext({ autoplay: this.getActivePlaybackState() });
      });

      this.queueToggleButton?.addEventListener('click', () => {
        this.toggleQueuePop();
      });

      this.queueCloseButton?.addEventListener('click', () => {
        this.setQueuePopOpen(false);
      });

      this.queueListEl?.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-pop-play-index]');
        if (!trigger) return;
        const trackIndex = Number(trigger.dataset.popPlayIndex);
        if (Number.isInteger(trackIndex)) {
          this.playTrackAt(trackIndex, { autoplay: true });
        }
      });

      this.coverWrapEl?.addEventListener('click', () => {
        this.toggleCoverLightbox();
      });

      if (this.queueListEl) {
        attachQueueDragAndDrop(this.queueListEl, (fromPos, toPos) => {
          this.reorderQueue(fromPos, toPos);
        });
      }

      this.audioEl.addEventListener('ended', () => {
        this.syncPlaybackUI(false);
        this.goToNext({ autoplay: true });
      });

      this.audioEl.addEventListener('play', () => {
        this.syncPlaybackUI(true);
        this.statusEl.textContent = this.playlist.length > 1
          ? 'Playback live. Queue auto-advances.'
          : 'Playback live. Placeholder track active.';
      });

      this.audioEl.addEventListener('pause', () => {
        if (this.audioEl.ended) return;
        this.syncPlaybackUI(false);
        this.statusEl.textContent = 'Playback paused.';
      });

      this.audioEl.addEventListener('error', () => {
        this.syncPlaybackUI(false);
        this.statusEl.textContent = 'Current audio file failed to load. Check the file path and format in AUDIO_PLAYLIST.';
      });
    }

    init() {
      if (!this.dockEl || !this.audioEl || !this.toggleButton || !this.stepButton) {
        return;
      }

      this.bindEvents();

      if (!this.playlist.length) {
        this.initEmptyState();
        return;
      }

      this.syncPlaybackUI(false);
      this.syncCollapseUI(false);
      this.disableControls(false);
      this.queue = this.buildInitialQueue();
      this.goToQueuePos(0);
      syncPlayerChrome();
      this.notify();
    }
  }

  function createLinkedTitle(item) {
    const titleEl = item.titleUrl ? document.createElement('a') : document.createElement('p');
    titleEl.className = 'queue-title';
    titleEl.textContent = item.title || 'Untitled';

    if (titleEl.tagName === 'A') {
      titleEl.href = item.titleUrl;
      titleEl.target = '_blank';
      titleEl.rel = 'noopener noreferrer';
    }

    return titleEl;
  }

  function renderTrackRail(listEl, playlist, queue, queueIndex, options = {}) {
    if (!listEl) return;
    const hideArtists = options.hideArtists || [];
    listEl.textContent = '';

    const len = queue.length;
    if (!len) return;
    const start = Math.max(0, queueIndex);

    for (let offset = 0; offset < len; offset += 1) {
      const position = (start + offset) % len;
      const trackIndex = queue[position];
      const item = playlist[trackIndex];
      if (!item) continue;
      if (hideArtists.includes(item.artist)) continue;

      const entry = document.createElement('li');
      entry.dataset.queuePosition = String(position);
      entry.dataset.trackIndex = String(trackIndex);
      entry.dataset.active = position === queueIndex ? 'true' : 'false';
      entry.draggable = true;

      const markerEl = document.createElement('span');
      markerEl.className = 'track-rail-index';
      markerEl.setAttribute('aria-hidden', 'true');
      markerEl.textContent = position === queueIndex ? '▸' : '';

      const bodyEl = document.createElement('span');
      bodyEl.className = 'track-rail-body';

      const titleEl = document.createElement('span');
      titleEl.className = 'track-rail-title';
      titleEl.textContent = item.title || 'Untitled';

      const detailEl = document.createElement('span');
      detailEl.className = 'track-rail-detail';
      const detailBits = [item.artist || 'AMEN'];
      if (item.album) detailBits.push(item.album);
      detailEl.textContent = detailBits.join(' · ');

      bodyEl.append(titleEl, detailEl);
      entry.append(markerEl, bodyEl);
      listEl.appendChild(entry);
    }
  }

  function attachQueueDragAndDrop(listEl, onReorder) {
    if (!listEl || listEl.dataset.dragWired === 'true') return;
    listEl.dataset.dragWired = 'true';

    let dragFromPos = null;

    const clearIndicators = () => {
      listEl.querySelectorAll('[data-drop-above]').forEach((el) => delete el.dataset.dropAbove);
      listEl.querySelectorAll('[data-drop-below]').forEach((el) => delete el.dataset.dropBelow);
    };

    const clearDragging = () => {
      listEl.querySelectorAll('[data-dragging]').forEach((el) => delete el.dataset.dragging);
    };

    listEl.addEventListener('dragstart', (event) => {
      const item = event.target.closest('[data-queue-position]');
      if (!item || !listEl.contains(item)) return;
      dragFromPos = Number(item.dataset.queuePosition);
      item.dataset.dragging = 'true';
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(dragFromPos));
      }
    });

    listEl.addEventListener('dragover', (event) => {
      if (dragFromPos === null) return;
      const item = event.target.closest('[data-queue-position]');
      if (!item || !listEl.contains(item)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const above = event.clientY < midY;

      clearIndicators();
      if (above) item.dataset.dropAbove = 'true';
      else item.dataset.dropBelow = 'true';
    });

    listEl.addEventListener('dragleave', (event) => {
      if (!listEl.contains(event.relatedTarget)) {
        clearIndicators();
      }
    });

    listEl.addEventListener('drop', (event) => {
      if (dragFromPos === null) return;
      const item = event.target.closest('[data-queue-position]');
      if (!item || !listEl.contains(item)) return;
      event.preventDefault();

      const targetPos = Number(item.dataset.queuePosition);
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const above = event.clientY < midY;
      const toPos = above ? targetPos : targetPos + 1;

      clearIndicators();
      clearDragging();

      if (Number.isInteger(toPos) && toPos !== dragFromPos) {
        onReorder(dragFromPos, toPos);
      }
      dragFromPos = null;
    });

    listEl.addEventListener('dragend', () => {
      clearIndicators();
      clearDragging();
      dragFromPos = null;
    });
  }

  function groupPlaylistByArtist(playlist, excludeArtists = []) {
    const seen = new Map();
    playlist.forEach((item, index) => {
      const artist = item.artist || 'AMEN';
      if (excludeArtists.includes(artist)) return;
      if (!seen.has(artist)) seen.set(artist, []);
      seen.get(artist).push({ item, index });
    });
    return Array.from(seen, ([artist, tracks]) => ({ artist, tracks }));
  }

  function renderQueueDeck(deckEl, playlist, options = {}) {
    if (!deckEl) return;
    deckEl.textContent = '';

    const groups = groupPlaylistByArtist(playlist, options.hideArtists || []);

    groups.forEach((group) => {
      const groupEl = document.createElement('section');
      groupEl.className = 'queue-group';

      const headEl = document.createElement('header');
      headEl.className = 'queue-group-head';

      const artistEl = document.createElement('h2');
      artistEl.className = 'queue-group-artist';
      artistEl.textContent = group.artist;

      headEl.append(artistEl);
      groupEl.appendChild(headEl);

      group.tracks.forEach(({ item, index }) => {
      const row = document.createElement('article');
      row.className = 'queue-row';
      row.dataset.queueRow = String(index);
      row.dataset.active = 'false';

      const metaEl = document.createElement('div');
      metaEl.className = 'queue-meta';

      const titleEl = createLinkedTitle(item);
      metaEl.append(titleEl);
      const context = item.album || item.stamp || '';
      if (context) {
        const contextEl = document.createElement('p');
        contextEl.className = 'queue-artist';
        contextEl.textContent = context;
        metaEl.append(contextEl);
      }

      const thumbButton = document.createElement('button');
      thumbButton.type = 'button';
      thumbButton.className = 'queue-thumb-button';
      thumbButton.dataset.playIndex = String(index);
      thumbButton.setAttribute('aria-label', `Play ${item.title || 'track'} now`);

      const thumbEl = document.createElement('img');
      thumbEl.className = 'queue-thumb';
      thumbEl.src = item.artwork || 'media/finalwedding.jpg';
      thumbEl.alt = '';
      thumbEl.loading = 'lazy';
      thumbButton.appendChild(thumbEl);

      const actionsEl = document.createElement('div');
      actionsEl.className = 'queue-actions';

      const queueNextButton = document.createElement('button');
      queueNextButton.type = 'button';
      queueNextButton.className = 'queue-button';
      queueNextButton.dataset.queueIndex = String(index);
      queueNextButton.dataset.queuePosition = 'next';
      queueNextButton.textContent = 'Queue Next';

      const queueLastButton = document.createElement('button');
      queueLastButton.type = 'button';
      queueLastButton.className = 'queue-button';
      queueLastButton.dataset.queueIndex = String(index);
      queueLastButton.dataset.queuePosition = 'last';
      queueLastButton.textContent = 'Queue Last';

      actionsEl.append(queueNextButton, queueLastButton);

      if (item.titleUrl || item.artistUrl) {
        const sourceLink = document.createElement('a');
        sourceLink.className = 'queue-link';
        sourceLink.href = item.titleUrl || item.artistUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        sourceLink.textContent = item.titleUrl ? 'Open Release' : 'Open Artist';
        actionsEl.appendChild(sourceLink);
      }

      row.append(thumbButton, metaEl, actionsEl);
      groupEl.appendChild(row);
      });

      deckEl.appendChild(groupEl);
    });
  }

  const audioPlayer = new AmenAudioPlayer(audioDockShell, AUDIO_PLAYLIST);
  audioPlayer.init();

  /* ── Timeline Scrubber + Integrated EQ ────────────────────── */
  (function initTimelineEQ() {
    const canvas = document.getElementById('audioEq');
    const audio = document.getElementById('audioPlayer');
    const timeline = document.getElementById('audioTimeline');
    const playedEl = document.getElementById('audioTimelinePlayed');
    const elapsedEl = document.getElementById('audioTimeElapsed');
    const remainingEl = document.getElementById('audioTimeRemaining');
    if (!canvas || !audio || !timeline || !playedEl) return;

    function formatTime(seconds) {
      if (!isFinite(seconds) || seconds < 0) seconds = 0;
      const total = Math.floor(seconds);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }

    const ctx = canvas.getContext('2d');
    let audioCtx = null;
    let analyser = null;
    let source = null;
    let freqData = null;
    let rafId = null;
    let connected = false;
    let isScrubbing = false;

    /* smoothed values — electronic tuning: fast attack, quick decay, clear separation */
    let smoothed = null;
    const SMOOTH_UP = 0.82;
    const SMOOTH_DOWN = 0.16;

    /* noise floor — values below this read as silence, so peaks stand out */
    const NOISE_FLOOR = 0.30;

    /* log-frequency mapping — sub-bass through air, but weighted toward lows */
    let binMap = null;       /* now stores [startBin, endBin] per bar */
    let binMapBarCount = 0;
    const LOG_MIN = Math.log10(22);
    const LOG_MAX = Math.log10(14000);

    function buildBinMap(barCount, sampleRate, binCount) {
      if (binMap && binMapBarCount === barCount) return;
      binMap = new Array(barCount);
      const nyquist = sampleRate / 2;
      for (let i = 0; i < barCount; i++) {
        /* log-spaced edges for this bar — gives each bar a frequency range */
        const logLo = LOG_MIN + (i / barCount) * (LOG_MAX - LOG_MIN);
        const logHi = LOG_MIN + ((i + 1) / barCount) * (LOG_MAX - LOG_MIN);
        const freqLo = Math.pow(10, logLo);
        const freqHi = Math.pow(10, logHi);
        const binLo = Math.max(0, Math.floor(freqLo / nyquist * binCount));
        const binHi = Math.min(binCount - 1, Math.ceil(freqHi / nyquist * binCount));
        /* store range — draw loop will average across these bins */
        binMap[i] = [binLo, binHi < binLo ? binLo : binHi];
      }
      binMapBarCount = barCount;
    }

    /* ── Web Audio hookup ── */
    function ensureAudioContext() {
      if (connected) return true;
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.28;
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        freqData = new Uint8Array(analyser.frequencyBinCount);
        smoothed = new Float32Array(1024);
        connected = true;
        return true;
      } catch (_) {
        return false;
      }
    }

    /* ── Canvas sizing ── */
    function sizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ── Progress helpers ── */
    function getProgress() {
      if (!audio.duration || !isFinite(audio.duration)) return 0;
      return audio.currentTime / audio.duration;
    }

    function syncPlayedBar() {
      const pct = getProgress() * 100;
      playedEl.style.width = pct + '%';
      timeline.setAttribute('aria-valuenow', Math.round(pct));

      if (elapsedEl) {
        elapsedEl.textContent = formatTime(audio.currentTime);
      }
      if (remainingEl) {
        const remaining = (audio.duration && isFinite(audio.duration))
          ? Math.max(0, audio.duration - audio.currentTime)
          : 0;
        remainingEl.textContent = `-${formatTime(remaining)}`;
      }
    }

    /* ── EQ draw loop ── */
    function draw() {
      if (!analyser) { rafId = requestAnimationFrame(draw); return; }
      analyser.getByteFrequencyData(freqData);

      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      ctx.clearRect(0, 0, W, H);

      const binCount = analyser.frequencyBinCount;
      const barCount = Math.min(128, Math.floor(W / 3));
      const gap = 1;
      const barW = Math.max(1.5, (W - gap * (barCount - 1)) / barCount);
      const progress = getProgress();
      const playedX = progress * W;

      /* build / cache the log-frequency bin mapping */
      buildBinMap(barCount, audioCtx.sampleRate, binCount);

      /* smooth the frequency data using log-mapped bin ranges */
      for (let i = 0; i < barCount; i++) {
        const [lo, hi] = binMap[i];
        /* average energy across all bins in this bar's frequency range */
        let sum = 0;
        let peak = 0;
        for (let b = lo; b <= hi; b++) {
          const v = freqData[b];
          sum += v;
          if (v > peak) peak = v;
        }
        const span = hi - lo + 1;
        /* average-forward blend — peaks catch transients but don't flatten the spectrum */
        const blended = (sum / span * 0.70 + peak * 0.30) / 255;
        /* noise floor — clamp quiet bands to zero, stretch louder range to full scale */
        const floored = Math.max(0, (blended - NOISE_FLOOR) / (1 - NOISE_FLOOR));
        /* gamma > 1 — expand the gap between quiet and loud bands (more punch) */
        const raw = Math.pow(floored, 1.15);
        const rate = raw > smoothed[i] ? SMOOTH_UP : SMOOTH_DOWN;
        smoothed[i] += (raw - smoothed[i]) * rate;
      }

      /* no synthetic bass boost — the FFT already reads lows accurately. */

      for (let i = 0; i < barCount; i++) {
        const norm = smoothed[i];
        const barH = Math.max(1, norm * H * 0.92);
        const x = i * (barW + gap);
        const y = H - barH;

        const inPlayed = (x + barW) <= playedX;

        if (inPlayed) {
          const a = 0.35 + norm * 0.65;
          ctx.fillStyle = 'rgba(0, 0, 255,' + a + ')';
        } else {
          const a = 0.08 + norm * 0.18;
          ctx.fillStyle = 'rgba(0, 0, 255,' + a + ')';
        }

        /* rounded-top bar */
        const r = Math.min(barW * 0.35, 2);
        if (barH > r * 2) {
          ctx.beginPath();
          ctx.moveTo(x, y + barH);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.lineTo(x + barW - r, y);
          ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
          ctx.lineTo(x + barW, y + barH);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barW, barH);
        }
      }

      syncPlayedBar();
      rafId = requestAnimationFrame(draw);
    }

    /* idle EQ bars driven by a sine — same bars as playing state, heights from sin() */
    let idleRafId = null;
    const prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function drawIdle(timestamp) {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      ctx.clearRect(0, 0, W, H);

      const t = (timestamp || performance.now()) / 1000;
      const progress = getProgress();
      const playedX = progress * W;

      /* match playing draw()'s bar layout */
      const barCount = Math.min(128, Math.floor(W / 3));
      const gap = 1;
      const barW = Math.max(1.5, (W - gap * (barCount - 1)) / barCount);

      /* slow, gentle phase drift — ~1 full sweep every 8s */
      const speed = prefersReducedMotion ? 0 : 0.12;
      const phaseShift = t * speed * Math.PI * 2;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barW + gap);
        const positionPhase = (i / barCount) * Math.PI * 3;
        /* primary wave + slower harmonic for organic variation */
        const primary = Math.sin(positionPhase - phaseShift) * 0.5 + 0.5;
        const harmonic = Math.sin(positionPhase * 0.4 - phaseShift * 0.6) * 0.5 + 0.5;
        const norm = primary * 0.7 + harmonic * 0.3;
        const barH = Math.max(2, norm * H * 0.8);
        const y = H - barH;

        const inPlayed = (x + barW) <= playedX;
        if (inPlayed) {
          const a = 0.35 + norm * 0.55;
          ctx.fillStyle = 'rgba(0, 0, 255,' + a + ')';
        } else {
          const a = 0.1 + norm * 0.22;
          ctx.fillStyle = 'rgba(0, 0, 255,' + a + ')';
        }

        const r = Math.min(barW * 0.35, 2);
        if (barH > r * 2) {
          ctx.beginPath();
          ctx.moveTo(x, y + barH);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.lineTo(x + barW - r, y);
          ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
          ctx.lineTo(x + barW, y + barH);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barW, barH);
        }
      }
    }

    function startIdleLoop() {
      if (idleRafId) return;
      sizeCanvas();
      const tick = (ts) => {
        drawIdle(ts);
        syncPlayedBar();
        if (prefersReducedMotion) {
          idleRafId = null;
          return;
        }
        idleRafId = requestAnimationFrame(tick);
      };
      idleRafId = requestAnimationFrame(tick);
    }

    function stopIdleLoop() {
      if (idleRafId) { cancelAnimationFrame(idleRafId); idleRafId = null; }
    }

    function startLoop() {
      if (!ensureAudioContext()) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      stopIdleLoop();
      sizeCanvas();
      if (smoothed) smoothed.fill(0);
      if (!rafId) draw();
    }

    function stopLoop() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      sizeCanvas();
      startIdleLoop();
    }

    /* ── Scrub / seek ── */
    function seekFromEvent(e) {
      const rect = timeline.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (audio.duration && isFinite(audio.duration)) {
        audio.currentTime = ratio * audio.duration;
      }
      syncPlayedBar();
    }

    function onPointerDown(e) {
      if (e.button && e.button !== 0) return;
      isScrubbing = true;
      seekFromEvent(e);
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isScrubbing) return;
      e.preventDefault();
      seekFromEvent(e);
    }

    function onPointerUp() {
      isScrubbing = false;
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);
    }

    timeline.addEventListener('mousedown', onPointerDown);
    timeline.addEventListener('touchstart', onPointerDown, { passive: true });

    /* keyboard seek: left/right arrows */
    timeline.addEventListener('keydown', (e) => {
      if (!audio.duration || !isFinite(audio.duration)) return;
      const step = audio.duration * 0.02;
      if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - step); syncPlayedBar(); }
      if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + step); syncPlayedBar(); }
    });

    /* ── Lifecycle ── */
    audio.addEventListener('play', startLoop);
    audio.addEventListener('pause', () => { stopLoop(); });
    audio.addEventListener('ended', () => { stopLoop(); });
    audio.addEventListener('timeupdate', () => { if (!rafId && !idleRafId) { sizeCanvas(); startIdleLoop(); } });
    audio.addEventListener('loadedmetadata', () => { sizeCanvas(); syncPlayedBar(); if (!rafId && !idleRafId) startIdleLoop(); });
    window.addEventListener('resize', () => { sizeCanvas(); });

    /* initial idle render */
    requestAnimationFrame(() => { sizeCanvas(); startIdleLoop(); });
  })();
  /* ── /Timeline Scrubber + Integrated EQ ──────────────────── */

  function hydrateYourMusicPage(mainEl) {
    const railEl = mainEl.querySelector('[data-player-rail]');
    const deckEl = mainEl.querySelector('[data-queue-deck]');
    const playlist = audioPlayer.getPlaylist();

    renderQueueDeck(deckEl, playlist, { hideArtists: ['AMEN'] });

    if (railEl) {
      attachQueueDragAndDrop(railEl, (fromPos, toPos) => {
        audioPlayer.reorderQueue(fromPos, toPos);
      });
    }

    const clickHandler = (event) => {
      const thumbTrigger = event.target.closest('[data-play-index]');
      if (thumbTrigger) {
        const trackIndex = Number(thumbTrigger.dataset.playIndex);
        if (Number.isInteger(trackIndex)) {
          audioPlayer.playTrackAt(trackIndex, { autoplay: true });
        }
        return;
      }

      const queueTrigger = event.target.closest('[data-queue-index]');
      if (queueTrigger) {
        const trackIndex = Number(queueTrigger.dataset.queueIndex);
        const position = queueTrigger.dataset.queuePosition;
        if (Number.isInteger(trackIndex)) {
          audioPlayer.moveInQueue(trackIndex, position);
        }
      }
    };

    const syncState = (snapshot) => {
      const activeIndex = snapshot.currentIndex;

      renderTrackRail(railEl, snapshot.playlist, snapshot.queue, snapshot.queueIndex);

      if (deckEl) {
        deckEl.querySelectorAll('[data-queue-row]').forEach((rowEl) => {
          rowEl.dataset.active = rowEl.dataset.queueRow === String(activeIndex) ? 'true' : 'false';
        });

        deckEl.querySelectorAll('[data-play-index]').forEach((buttonEl) => {
          buttonEl.dataset.active = buttonEl.dataset.playIndex === String(activeIndex) ? 'true' : 'false';
        });
      }
    };

    deckEl?.addEventListener('click', clickHandler);
    const unsubscribe = audioPlayer.subscribe(syncState);
    scheduleChromeSync();

    return () => {
      deckEl?.removeEventListener('click', clickHandler);
      unsubscribe();
    };
  }

  function hydrateMyMusicPage() {
    scheduleChromeSync();
    return () => {};
  }

  function initAsciiPortrait(mainEl) {
    const canvas = mainEl.querySelector('#heroCanvas');
    const stage = mainEl.querySelector('#heroStage');
    const hint = mainEl.querySelector('#heroHint');
    const fxToggle = mainEl.querySelector('#fxToggle');

    if (!canvas || !stage || !hint || !fxToggle) {
      scheduleChromeSync();
      return () => {};
    }

    let destroyed = false;
    const ctx = canvas.getContext('2d', { alpha: false });

    const RAMP = ' .·:;+=*oO0#%&WMN@▓█';
    const MONO_FONT_FAMILY = '"IBM Plex Mono", "Courier New", monospace';
    const FONT_SIZE = 7;
    const LINE_HEIGHT = 8;
    const FONT = `${FONT_SIZE}px ${MONO_FONT_FAMILY}`;
    const BASE_CHAR_W = FONT_SIZE * 0.6;
    const COMPACT_STAGE_BREAKPOINT = 680;
    const MOBILE_ASCII_CLARITY = isCompactTouch && !saveData;
    const COMPACT_FONT_SIZE = MOBILE_ASCII_CLARITY ? 6.1 : 5.6;
    const COMPACT_LINE_HEIGHT = MOBILE_ASCII_CLARITY ? 6.35 : 5.7;
    const PHOTO_SRC = 'portrait.jpg';
    const PHOTO_SAMPLE_MAX_W = MOBILE_ASCII_CLARITY ? 1800 : 1400;
    const PHOTO_SAMPLE_MAX_H = MOBILE_ASCII_CLARITY ? 1400 : 1100;
    const ACTIVE_FRAME_INTERVAL = lowPower ? 34 : (isCompactTouch ? 20 : 16);
    const IDLE_FRAME_INTERVAL = lowPower ? 52 : (isCompactTouch ? 34 : 26);
    const MAX_RENDER_DPR = MOBILE_ASCII_CLARITY
      ? (isSafari ? 1.75 : 2)
      : (lowPower ? (isTouchOnly ? 1.15 : 1.25) : (isCompactTouch ? 1.25 : 1.6));
    const MOBILE_GLITCH_LITE = isTouchOnly && !reducedMotion;
    const GLITCH_CHANCE = reducedMotion ? 0 : (isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.0018 : 0.0038) : (MOBILE_GLITCH_LITE ? 0.0045 : (lowPower ? 0 : 0.0125)));
    const GLITCH_DURATION = 14;
    const ROW_GLITCH_CHANCE = reducedMotion ? 0 : (isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.004 : 0.009) : (MOBILE_GLITCH_LITE ? 0.012 : (lowPower ? 0 : 0.03)));
    const ROW_GLITCH_MAX_SHIFT = isCompactTouch ? (MOBILE_ASCII_CLARITY ? 12 : 20) : 40;
    const FLASH_LINE_CHANCE = reducedMotion ? 0 : (isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.005 : 0.022) : (MOBILE_GLITCH_LITE ? 0.024 : (lowPower ? 0.016 : 0.05)));
    const FLASH_LINE_MAX_COUNT = isCompactTouch ? 1 : 2;
    const FLASH_LINE_ALPHA = isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.72 : (lowPower ? 0.92 : 0.94)) : (lowPower ? 0.92 : 0.985);
    const FLASH_LINE_EDGE_ALPHA = isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.04 : (lowPower ? 0.08 : 0.1)) : (lowPower ? 0.08 : 0.14);
    const FLASH_LINE_HEIGHT_MIN = isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.7 : 0.8) : 0.9;
    const FLASH_LINE_HEIGHT_MAX = isCompactTouch ? (MOBILE_ASCII_CLARITY ? 1.2 : 1.8) : 2.35;
    const SCANLINE_ALPHA = isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.004 : (lowPower ? 0.008 : 0.018)) : (lowPower ? 0.04 : 0.09);
    const SCANLINE_SPACING = isCompactTouch ? (MOBILE_ASCII_CLARITY ? 12 : 10) : (lowPower ? 6 : 4);
    const FLICKER_CHANCE = reducedMotion ? 0 : (isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.0018 : 0.0045) : (MOBILE_GLITCH_LITE ? 0.006 : (lowPower ? 0 : 0.02)));
    const TEAR_CHANCE = reducedMotion ? 0 : (isCompactTouch ? (MOBILE_ASCII_CLARITY ? 0.0015 : 0.012) : (MOBILE_GLITCH_LITE ? 0.018 : (lowPower ? 0 : 0.075)));
    const SCRAMBLE_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]<>?/|\\!@#$%^&*';
    const SCANLINE_STYLE = `rgba(0,0,0,${SCANLINE_ALPHA})`;
    const INTERFERENCE_ROWS = 8;
    const INTERFERENCE_GLITCH_MULT = 6;
    const INTERFERENCE_SHIFT_MULT = 2.5;
    const PULSE_SPEED = 3;
    const PULSE_GLITCH_FILL = reducedMotion ? 0 : (isCompactTouch ? 0.46 : (MOBILE_GLITCH_LITE ? 0.54 : (lowPower ? 0.32 : 0.7)));
    const PULSE_WIDTH = lowPower ? 4 : 6;
    const INTERACTION_BOOST_MS = lowPower ? 180 : 260;
    const THRESH_PUSH = 7;
    const THRESH_SPEED = 0.00032;
    const THRESH_PERIOD_MS = (Math.PI * 2) / THRESH_SPEED;
    const BASE_RANGE = RAMP.length - 1 - THRESH_PUSH;
    const BG_MONO = 242;
    const BLANK_CUTOFF = 1.22;
    const BLANK_HOLD_MS = 300;
    const BLANK_HOLD = (1 - Math.cos(Math.PI * Math.min(BLANK_HOLD_MS / THRESH_PERIOD_MS, 0.45))) * 0.5;
    const BLANK_FADE_IN = 0.16;
    const DETAIL_HOLD_MS = 3000;
    const DETAIL_HOLD = (1 + Math.cos(Math.PI * Math.min(DETAIL_HOLD_MS / THRESH_PERIOD_MS, 0.45))) * 0.5;
    const OUTLINE_CUTOFF = 0.42;
    const REVEAL_FEATHER = 0.18;
    const MAX_CELLS = MOBILE_ASCII_CLARITY ? 22000 : (lowPower ? 14000 : (isCompactTouch ? 18000 : 26000));
    const GREY_LUT = new Array(256);
    const RAMP_LEN = RAMP.length;
    const SCRAMBLE_LEN = SCRAMBLE_POOL.length;
    const BASE_SAMPLE_KERNEL = [
      [0, 0, 0.5],
      [-1, 0, 0.125],
      [1, 0, 0.125],
      [0, -1, 0.125],
      [0, 1, 0.125],
    ];
    const MOBILE_SAMPLE_KERNEL = [
      [0, 0, 0.28],
      [-1, 0, 0.12],
      [1, 0, 0.12],
      [0, -1, 0.12],
      [0, 1, 0.12],
      [-1, -1, 0.06],
      [1, -1, 0.06],
      [-1, 1, 0.06],
      [1, 1, 0.06],
    ];

    for (let index = 0; index < 256; index += 1) {
      GREY_LUT[index] = `rgb(${index},${index},${index})`;
    }

    let W = 0;
    let H = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let charW = BASE_CHAR_W;
    let lineH = LINE_HEIGHT;
    let fontSize = FONT_SIZE;
    let activeFont = FONT;
    let cellCount = 0;
    let cellX;
    let cellY;
    let cellRow;
    let cellBaseChar;
    let cellBaseNorm;
    let cellMono;
    let cellGlitchT;
    let cellFlickerT;
    let cellDither;
    let photoData = null;
    let photoW = 0;
    let photoH = 0;
    let rowGlitchOffsets;
    let rowGlitchTargets;
    let mouseX = -9999;
    let mouseY = -9999;
    let mouseRow = -1;
    let mouseInStage = false;
    let pageVisible = !document.hidden;
    let stageVisible = true;
    let interactionBoostUntil = 0;
    let effectsOn = true;
    let pulseActive = false;
    let pulseOriginRow = 0;
    let pulseRadius = 0;
    let scanlinePath = null;
    let cachedRect = stage.getBoundingClientRect();
    let lastFrame = 0;
    let resizeTimeout = 0;
    let animId = null;
    let mobileFxTimer = 0;
    let stageObserver = null;

    function clamp01(value) {
      if (value <= 0) return 0;
      if (value >= 1) return 1;
      return value;
    }

    function smoothstep(edge0, edge1, value) {
      const span = edge1 - edge0 || 1;
      const x = clamp01((value - edge0) / span);
      return x * x * (3 - 2 * x);
    }

    function mix(start, end, amount) {
      return start + (end - start) * amount;
    }

    function getMonoFont(size) {
      return `${size}px ${MONO_FONT_FAMILY}`;
    }

    function getLineHeight(stageWidth, size) {
      if (stageWidth <= COMPACT_STAGE_BREAKPOINT) {
        return MOBILE_ASCII_CLARITY ? Math.max(size + 0.25, COMPACT_LINE_HEIGHT) : COMPACT_LINE_HEIGHT;
      }

      return Math.max(size + 1, LINE_HEIGHT);
    }

    function measureMonoCharWidth(size) {
      ctx.font = getMonoFont(size);
      return Math.max(1, ctx.measureText('M').width);
    }

    function alignToDevicePixel(value) {
      return Math.round(value * dpr) / dpr;
    }

    function readPhotoLuminance(x, y) {
      const px = Math.min(Math.max(x, 0), photoW - 1);
      const py = Math.min(Math.max(y, 0), photoH - 1);
      const x0 = Math.floor(px);
      const y0 = Math.floor(py);
      const x1 = Math.min(x0 + 1, photoW - 1);
      const y1 = Math.min(y0 + 1, photoH - 1);
      const tx = px - x0;
      const ty = py - y0;

      function luminanceAt(ix, iy) {
        const pixelIndex = (iy * photoW + ix) * 4;
        return 0.299 * photoData[pixelIndex] + 0.587 * photoData[pixelIndex + 1] + 0.114 * photoData[pixelIndex + 2];
      }

      const top = mix(luminanceAt(x0, y0), luminanceAt(x1, y0), tx);
      const bottom = mix(luminanceAt(x0, y1), luminanceAt(x1, y1), tx);
      return mix(top, bottom, ty);
    }

    function samplePhoto(u, v, radiusU = 0, radiusV = 0) {
      const px = u * (photoW - 1);
      const py = v * (photoH - 1);
      if (radiusU <= 0 || radiusV <= 0) {
        return readPhotoLuminance(px, py);
      }

      const kernel = MOBILE_ASCII_CLARITY ? MOBILE_SAMPLE_KERNEL : BASE_SAMPLE_KERNEL;
      const radiusX = radiusU * (photoW - 1);
      const radiusY = radiusV * (photoH - 1);
      let total = 0;
      let totalWeight = 0;

      kernel.forEach(([offsetX, offsetY, weight]) => {
        total += readPhotoLuminance(px + offsetX * radiusX, py + offsetY * radiusY) * weight;
        totalWeight += weight;
      });

      return totalWeight > 0 ? total / totalWeight : readPhotoLuminance(px, py);
    }

    function setupFrame() {
      ctx.fillStyle = '#f2f2ee';
      ctx.fillRect(0, 0, W, H);
      ctx.textBaseline = 'top';
      ctx.font = activeFont;
    }

    function drawFlashLines(intensity = 1) {
      if (intensity <= 0.001 || FLASH_LINE_CHANCE <= 0 || Math.random() >= FLASH_LINE_CHANCE * intensity) {
        return;
      }

      const count = 1 + ((FLASH_LINE_MAX_COUNT > 1 && Math.random() < 0.38 * intensity) ? 1 : 0);

      for (let index = 0; index < count; index += 1) {
        const bandHeight = Math.max(
          1,
          Math.round(lineH * mix(FLASH_LINE_HEIGHT_MIN, FLASH_LINE_HEIGHT_MAX, Math.pow(Math.random(), 0.42))),
        );
        const y = Math.max(0, Math.min(H - bandHeight, Math.random() * H - bandHeight * 0.5));

        ctx.fillStyle = `rgba(242,242,238,${Math.min(1, FLASH_LINE_ALPHA * intensity)})`;
        ctx.fillRect(0, y, W, bandHeight);

        ctx.fillStyle = `rgba(15,15,15,${FLASH_LINE_EDGE_ALPHA * intensity})`;
        ctx.fillRect(0, Math.max(0, y - 1), W, 1);
        ctx.fillRect(0, Math.min(H - 1, y + bandHeight), W, 1);
      }
    }

    function canAnimate() {
      return !destroyed && effectsOn && !reducedMotion && pageVisible && stageVisible;
    }

    function bumpInteractionBoost() {
      interactionBoostUntil = performance.now() + INTERACTION_BOOST_MS;
    }

    function getFrameInterval(now) {
      if (mouseInStage || pulseActive || now < interactionBoostUntil) return ACTIVE_FRAME_INTERVAL;
      return IDLE_FRAME_INTERVAL;
    }

    function getGridMetrics(stageWidth) {
      if (stageWidth <= COMPACT_STAGE_BREAKPOINT) {
        return {
          fontSize: COMPACT_FONT_SIZE,
          lineH: getLineHeight(stageWidth, COMPACT_FONT_SIZE),
        };
      }

      return {
        fontSize: FONT_SIZE,
        lineH: getLineHeight(stageWidth, FONT_SIZE),
      };
    }

    function buildGrid() {
      const rect = stage.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, isSafari ? 1.5 : MAX_RENDER_DPR);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const gridMetrics = getGridMetrics(W);
      fontSize = gridMetrics.fontSize;
      lineH = gridMetrics.lineH;
      charW = measureMonoCharWidth(fontSize);

      const photoAspect = photoW / photoH;
      let testCols;
      let testRows;

      function fitGrid() {
        const maxCols = Math.floor(W / charW);
        const maxRows = Math.floor(H / lineH);
        const colsFromH = Math.floor(maxRows * photoAspect * (lineH / charW));

        if (colsFromH <= maxCols) {
          testRows = maxRows;
          testCols = colsFromH;
        } else {
          testCols = maxCols;
          testRows = Math.floor(maxCols * charW / (photoAspect * lineH));
        }

        if (testCols < 1) testCols = 1;
        if (testRows < 1) testRows = 1;
      }

      fitGrid();

      while (testCols * testRows > MAX_CELLS && fontSize < 14) {
        fontSize += 0.5;
        lineH = getLineHeight(W, fontSize);
        charW = measureMonoCharWidth(fontSize);
        fitGrid();
      }

      activeFont = getMonoFont(fontSize);
      cols = testCols;
      rows = testRows;

      rowGlitchOffsets = new Float32Array(rows);
      rowGlitchTargets = new Float32Array(rows);

      const count = cols * rows;
      cellX = new Float32Array(count);
      cellY = new Float32Array(count);
      cellRow = new Uint16Array(count);
      cellBaseChar = new Uint8Array(count);
      cellBaseNorm = new Float32Array(count);
      cellMono = new Uint8Array(count);
      cellGlitchT = new Uint8Array(count);
      cellFlickerT = new Uint8Array(count);
      cellDither = new Float32Array(count);
      cellCount = count;

      const offsetX = alignToDevicePixel((W - cols * charW) / 2);
      const offsetY = alignToDevicePixel((H - rows * lineH) / 2);
      const sampleRadiusU = (MOBILE_ASCII_CLARITY ? 0.68 : 0.42) / Math.max(cols, 1);
      const sampleRadiusV = (MOBILE_ASCII_CLARITY ? 0.68 : 0.42) / Math.max(rows, 1);
      let cellIndex = 0;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = alignToDevicePixel(offsetX + col * charW);
          const y = alignToDevicePixel(offsetY + row * lineH);
          const u = col / (cols - 1 || 1);
          const v = row / (rows - 1 || 1);
          const lum = samplePhoto(u, v, sampleRadiusU, sampleRadiusV);
          const normL = clamp01(((lum / 255) - 0.5) * (MOBILE_ASCII_CLARITY ? 1.08 : 1) + 0.5);
          const g = Math.pow(normL, 2);
          const curvedL = g < 0.5 ? 2 * g * g : 1 - 2 * (1 - g) * (1 - g);
          const charIndex = Math.round((1 - curvedL) * BASE_RANGE);
          const baseNorm = charIndex / BASE_RANGE;
          const mono = Math.min(Math.round(curvedL * 100 + 15), 160);

          cellX[cellIndex] = x;
          cellY[cellIndex] = y;
          cellRow[cellIndex] = row;
          cellBaseChar[cellIndex] = charIndex;
          cellBaseNorm[cellIndex] = baseNorm;
          cellMono[cellIndex] = mono;
          cellGlitchT[cellIndex] = 0;
          cellFlickerT[cellIndex] = 0;
          cellDither[cellIndex] = Math.random();
          cellIndex += 1;
        }
      }
    }

    function buildScanlines() {
      scanlinePath = new Path2D();
      for (let y = 0; y < H; y += SCANLINE_SPACING) {
        scanlinePath.rect(0, y, W, 1);
      }
    }

    function renderStatic() {
      setupFrame();
      let prevColor = -1;

      for (let index = 0; index < cellCount; index += 1) {
        const charIndex = cellBaseChar[index];
        if (charIndex < 1) continue;
        const mono = cellMono[index];
        if (mono !== prevColor) {
          ctx.fillStyle = GREY_LUT[mono];
          prevColor = mono;
        }
        ctx.fillText(RAMP[charIndex], cellX[index], cellY[index]);
      }

      ctx.fillStyle = SCANLINE_STYLE;
      ctx.fill(scanlinePath);
    }

    function stopRenderLoop() {
      if (!animId) return;
      cancelAnimationFrame(animId);
      animId = null;
    }

    function startRenderLoop() {
      if (animId || !photoData || !canAnimate()) return;
      lastFrame = 0;
      animId = requestAnimationFrame(render);
    }

    function syncRenderLoop() {
      if (canAnimate()) {
        startRenderLoop();
        return;
      }
      stopRenderLoop();
    }

    function clearMobileFxTimer() {
      if (!mobileFxTimer) return;
      window.clearTimeout(mobileFxTimer);
      mobileFxTimer = 0;
    }

    function setMobileFxVisible(visible) {
      if (!isTouchOnly || reducedMotion) return;
      fxToggle.classList.toggle('is-visible', visible);
    }

    function bumpMobileFxVisibility() {
      if (!isTouchOnly || reducedMotion) return;
      setMobileFxVisible(true);
      clearMobileFxTimer();
      mobileFxTimer = window.setTimeout(() => {
        fxToggle.classList.remove('is-visible');
        mobileFxTimer = 0;
      }, 1800);
    }

    function updateHintCopy() {
      if (reducedMotion) return;
      if (isTouchOnly) {
        hint.textContent = effectsOn
          ? (lowPower ? 'tap to pulse · tap fx to pause' : 'tap to corrupt · tap fx to pause')
          : 'tap fx to animate the portrait';
        return;
      }

      hint.textContent = effectsOn
        ? 'hover to interfere · click to corrupt · R to reset'
        : 'fx is off · use the toggle to restart';
    }

    function setEffectsState(nextState) {
      effectsOn = nextState;
      fxToggle.textContent = effectsOn ? 'fx: on' : 'fx: off';
      updateHintCopy();
      if (isTouchOnly && !reducedMotion) bumpMobileFxVisibility();

      if (!effectsOn) {
        stopRenderLoop();
        renderStatic();
        return;
      }

      if (canAnimate()) {
        startRenderLoop();
      } else if (photoData) {
        renderStatic();
      }
    }

    function refreshStageRect() {
      cachedRect = stage.getBoundingClientRect();
    }

    function render(now) {
      if (!canAnimate()) {
        animId = null;
        return;
      }

      if (now - lastFrame < getFrameInterval(now)) {
        animId = requestAnimationFrame(render);
        return;
      }
      lastFrame = now;

      const rawWave = (Math.sin(now * THRESH_SPEED - Math.PI / 2) + 1) * 0.5;
      const visibilitySignal = effectsOn ? smoothstep(BLANK_HOLD, BLANK_FADE_IN, rawWave) : 1;
      const outlineReveal = effectsOn ? smoothstep(0.08, 0.52, rawWave) : 1;
      const detailReveal = effectsOn ? smoothstep(0.5, DETAIL_HOLD, rawWave) : 0;
      const visibilityCutoff = mix(BLANK_CUTOFF, OUTLINE_CUTOFF, outlineReveal) - detailReveal * 0.48;
      const threshPush = detailReveal * THRESH_PUSH;
      const detailDarken = detailReveal * 0.42;

      setupFrame();

      if (pulseActive) {
        pulseRadius += PULSE_SPEED;
        if (pulseRadius > rows) pulseActive = false;
      }

      if (visibilitySignal <= 0.001) {
        rowGlitchOffsets.fill(0);
        rowGlitchTargets.fill(0);
        cellGlitchT.fill(0);
        cellFlickerT.fill(0);
        animId = canAnimate() ? requestAnimationFrame(render) : null;
        return;
      }

      for (let row = 0; row < rows; row += 1) {
        rowGlitchTargets[row] *= 0.92;

        let glitchChance = ROW_GLITCH_CHANCE;
        let maxShift = ROW_GLITCH_MAX_SHIFT;

        if (mouseInStage && mouseRow >= 0) {
          const dist = Math.abs(row - mouseRow);
          if (dist < INTERFERENCE_ROWS) {
            const proximity = 1 - dist / INTERFERENCE_ROWS;
            glitchChance *= 1 + proximity * (INTERFERENCE_SHIFT_MULT - 1);
            maxShift *= 1 + proximity * (INTERFERENCE_SHIFT_MULT - 1);
          }
        }

        if (pulseActive) {
          const distFromOrigin = Math.abs(row - pulseOriginRow);
          if (distFromOrigin >= pulseRadius - PULSE_WIDTH && distFromOrigin <= pulseRadius) {
            glitchChance = 0.5;
            maxShift = ROW_GLITCH_MAX_SHIFT * 3;
          }
        }

        if (Math.random() < glitchChance) {
          rowGlitchTargets[row] = (Math.random() - 0.5) * 2 * maxShift;
        }

        if (Math.random() < 0.002) {
          const blockSize = (Math.random() * 8 + 3) | 0;
          const shift = (Math.random() - 0.5) * 2 * maxShift;
          for (let block = 0; block < blockSize && row + block < rows; block += 1) {
            rowGlitchTargets[row + block] = shift * (1 - block / blockSize);
          }
        }

        rowGlitchOffsets[row] += (rowGlitchTargets[row] - rowGlitchOffsets[row]) * 0.18;
      }

      let prevColor = -1;

      for (let index = 0; index < cellCount; index += 1) {
        const baseChar = cellBaseChar[index];
        if (baseChar < 1) continue;

        const baseNorm = cellBaseNorm[index];
        const reveal = smoothstep(
          visibilityCutoff - REVEAL_FEATHER,
          visibilityCutoff + REVEAL_FEATHER,
          baseNorm,
        ) * visibilitySignal;

        if (reveal <= 0.01) {
          cellGlitchT[index] = 0;
          cellFlickerT[index] = 0;
          continue;
        }

        if (cellFlickerT[index] > 0) {
          cellFlickerT[index] -= 1;
          continue;
        }

        const row = cellRow[index];

        let flickerChance = FLICKER_CHANCE * reveal;
        let glitchChance = GLITCH_CHANCE * reveal * (0.4 + detailReveal * 0.6);
        if (mouseInStage && mouseRow >= 0) {
          const dist = Math.abs(row - mouseRow);
          if (dist < INTERFERENCE_ROWS) {
            const proximity = 1 - dist / INTERFERENCE_ROWS;
            flickerChance *= 1 + proximity * (INTERFERENCE_GLITCH_MULT - 1);
            glitchChance *= 1 + proximity * (INTERFERENCE_GLITCH_MULT - 1);
          }
        }

        if (pulseActive) {
          const distFromOrigin = Math.abs(row - pulseOriginRow);
          if (distFromOrigin >= pulseRadius - PULSE_WIDTH && distFromOrigin <= pulseRadius) {
            if (Math.random() < PULSE_GLITCH_FILL * reveal) {
              cellGlitchT[index] = GLITCH_DURATION;
            }
          }
        }

        if (Math.random() < flickerChance) {
          cellFlickerT[index] = (Math.random() * 8 + 2) | 0;
          continue;
        }

        let char;
        if (cellGlitchT[index] > 0) {
          cellGlitchT[index] -= 1;
          char = SCRAMBLE_POOL[(Math.random() * SCRAMBLE_LEN) | 0];
        } else {
          if (Math.random() < glitchChance) {
            cellGlitchT[index] = GLITCH_DURATION;
          }
          let charIndex = (baseChar * mix(0.52, 1, reveal) + threshPush * reveal + cellDither[index]) | 0;
          if (charIndex >= RAMP_LEN) charIndex = RAMP_LEN - 1;
          char = RAMP[charIndex];
        }

        const baseMono = cellMono[index];
        const monoTarget = Math.max(0, Math.round(baseMono * (1 - detailDarken)));
        const mono = Math.round(mix(BG_MONO, monoTarget, reveal));
        if (mono !== prevColor) {
          ctx.fillStyle = GREY_LUT[mono];
          prevColor = mono;
        }
        const drawX = MOBILE_ASCII_CLARITY
          ? alignToDevicePixel(cellX[index] + rowGlitchOffsets[row])
          : cellX[index] + rowGlitchOffsets[row];
        ctx.fillText(char, drawX, cellY[index]);
      }

      const scanlineAlpha = SCANLINE_ALPHA * visibilitySignal;
      if (scanlineAlpha > 0.001) {
        ctx.fillStyle = `rgba(0,0,0,${scanlineAlpha})`;
        ctx.fill(scanlinePath);
      }

      if (Math.random() < TEAR_CHANCE * visibilitySignal) {
        const count = (Math.random() * 4 + 1) | 0;
        for (let tear = 0; tear < count; tear += 1) {
          const tearY = Math.random() * H;
          const tearHeight = Math.random() * 6 + 2;
          const tearShift = (Math.random() - 0.5) * 50;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, tearY, W, tearHeight);
          ctx.clip();
          ctx.drawImage(canvas, tearShift, 0);
          ctx.restore();
        }
      }

      drawFlashLines(visibilitySignal * (pulseActive ? 1.3 : (mouseInStage ? 1.15 : 1)));

      animId = canAnimate() ? requestAnimationFrame(render) : null;
    }

    function loadPhoto() {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          const offscreenCanvas = document.createElement('canvas');
          const scale = Math.min(PHOTO_SAMPLE_MAX_W / image.width, PHOTO_SAMPLE_MAX_H / image.height, 1);
          offscreenCanvas.width = photoW = Math.round(image.width * scale);
          offscreenCanvas.height = photoH = Math.round(image.height * scale);
          const offscreenContext = offscreenCanvas.getContext('2d');
          offscreenContext.drawImage(image, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
          photoData = offscreenContext.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height).data;
          resolve();
        };
        image.onerror = reject;
        image.src = PHOTO_SRC;
      });
    }

    const onPointerMove = (event) => {
      if (isTouchOnly) {
        mouseInStage = false;
        mouseRow = -1;
        return;
      }
      if (reducedMotion || !effectsOn) return;
      bumpInteractionBoost();
      mouseX = event.clientX - cachedRect.left;
      mouseY = event.clientY - cachedRect.top;
      mouseInStage = true;
      const offsetY = (H - rows * lineH) / 2;
      mouseRow = Math.floor((mouseY - offsetY) / lineH);
    };

    const onPointerDown = (event) => {
      if (isTouchOnly) {
        mouseInStage = false;
        mouseRow = -1;
        hint.classList.add('faded');
        return;
      }
      if (reducedMotion || !effectsOn) return;
      bumpInteractionBoost();
      mouseX = event.clientX - cachedRect.left;
      mouseY = event.clientY - cachedRect.top;
      mouseInStage = true;
      const offsetY = (H - rows * lineH) / 2;
      mouseRow = Math.floor((mouseY - offsetY) / lineH);
      hint.classList.add('faded');
    };

    const onPointerLeave = () => {
      mouseInStage = false;
      mouseRow = -1;
    };

    const onClickPulse = (event) => {
      if (reducedMotion || !effectsOn) return;
      bumpInteractionBoost();
      const cy = event.clientY - cachedRect.top;
      const offsetY = (H - rows * lineH) / 2;
      pulseOriginRow = Math.floor((cy - offsetY) / lineH);
      pulseRadius = 0;
      pulseActive = true;
    };

    const onKeyDown = (event) => {
      if (event.key === 'r' || event.key === 'R') {
        bumpInteractionBoost();
        if (cellGlitchT) cellGlitchT.fill(0);
        if (cellFlickerT) cellFlickerT.fill(0);
        if (rowGlitchTargets) rowGlitchTargets.fill(0);
        pulseActive = false;
      }
    };

    const onFxPointerDown = (event) => {
      event.stopPropagation();
      bumpMobileFxVisibility();
    };

    const onFxClick = (event) => {
      event.stopPropagation();
      setEffectsState(!effectsOn);
    };

    const onTouchVisibilityNudge = () => {
      bumpMobileFxVisibility();
    };

    const onResize = () => {
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        scheduleChromeSync();
        if (!photoData || destroyed) return;
        refreshStageRect();
        buildGrid();
        buildScanlines();
        if (!effectsOn || reducedMotion) {
          renderStatic();
        }
      }, 100);
    };

    const onWindowScroll = () => {
      refreshStageRect();
      scheduleChromeSync();
    };
    const onOrientationChange = () => {
      scheduleChromeSync();
    };
    const onViewportChromeChange = () => {
      scheduleChromeSync();
    };

    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible) refreshStageRect();
      syncRenderLoop();
    };

    const motionChangeHandler = () => {
      if (!photoData || destroyed) return;
      buildGrid();
      buildScanlines();
      if (reducedMotion) {
        stopRenderLoop();
        hint.style.display = 'none';
        fxToggle.style.display = 'none';
        renderStatic();
        return;
      }
      hint.style.display = '';
      fxToggle.style.display = '';
      if (effectsOn) {
        syncRenderLoop();
      } else {
        renderStatic();
      }
    };

    activeMotionHandler = motionChangeHandler;

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove, { passive: true });
    stage.addEventListener('pointerleave', onPointerLeave);
    stage.addEventListener('pointerup', onPointerLeave);
    stage.addEventListener('pointercancel', onPointerLeave);
    stage.addEventListener('click', onClickPulse);
    document.addEventListener('keydown', onKeyDown);
    fxToggle.addEventListener('pointerdown', onFxPointerDown);
    fxToggle.addEventListener('click', onFxClick);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    window.addEventListener('orientationchange', onOrientationChange);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportChromeChange);
      window.visualViewport.addEventListener('scroll', onViewportChromeChange);
    }

    if (isTouchOnly) {
      document.addEventListener('pointerdown', onTouchVisibilityNudge, { passive: true });
      window.addEventListener('scroll', onTouchVisibilityNudge, { passive: true });
      document.addEventListener('keydown', onTouchVisibilityNudge);
    }

    if ('IntersectionObserver' in window) {
      stageObserver = new IntersectionObserver((entries) => {
        stageVisible = entries[0] ? entries[0].isIntersecting : true;
        if (stageVisible) refreshStageRect();
        syncRenderLoop();
      }, { threshold: 0.08 });
      stageObserver.observe(stage);
    }

    async function init() {
      try {
        await loadPhoto();
      } catch (error) {
        hint.textContent = 'portrait unavailable';
        fxToggle.style.display = 'none';
        return;
      }

      if (destroyed) return;

      updateHintCopy();
      scheduleChromeSync();
      buildGrid();
      buildScanlines();

      if (reducedMotion) {
        renderStatic();
        hint.style.display = 'none';
        fxToggle.style.display = 'none';
        effectsOn = false;
      } else {
        window.setTimeout(() => {
          if (!destroyed) hint.classList.add('faded');
        }, 3000);
        if (lowPower && !isTouchOnly) {
          setEffectsState(false);
        } else {
          setEffectsState(true);
        }
        if (isTouchOnly) {
          bumpMobileFxVisibility();
        }
      }
    }

    fontsReadyPromise.then(() => {
      if (destroyed) return;
      init();
    });

    return () => {
      destroyed = true;
      stopRenderLoop();
      clearMobileFxTimer();
      window.clearTimeout(resizeTimeout);
      if (activeMotionHandler === motionChangeHandler) {
        activeMotionHandler = null;
      }

      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('pointerup', onPointerLeave);
      stage.removeEventListener('pointercancel', onPointerLeave);
      stage.removeEventListener('click', onClickPulse);
      document.removeEventListener('keydown', onKeyDown);
      fxToggle.removeEventListener('pointerdown', onFxPointerDown);
      fxToggle.removeEventListener('click', onFxClick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onWindowScroll);
      window.removeEventListener('orientationchange', onOrientationChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onViewportChromeChange);
        window.visualViewport.removeEventListener('scroll', onViewportChromeChange);
      }
      if (isTouchOnly) {
        document.removeEventListener('pointerdown', onTouchVisibilityNudge);
        window.removeEventListener('scroll', onTouchVisibilityNudge);
        document.removeEventListener('keydown', onTouchVisibilityNudge);
      }
      if (stageObserver) {
        stageObserver.disconnect();
      }
    };
  }

  function hydratePage(mainEl) {
    if (!mainEl) return () => {};

    const pageType = mainEl.dataset.page;
    scheduleChromeSync();

    if (pageType === 'home') {
      return initAsciiPortrait(mainEl);
    }

    if (pageType === 'your-music') {
      return hydrateYourMusicPage(mainEl);
    }

    if (pageType === 'my-music') {
      return hydrateMyMusicPage(mainEl);
    }

    return () => {};
  }

  function syncNav() {
    const currentPage = document.body.dataset.page || '';
    document.querySelectorAll('[data-nav-link]').forEach((linkEl) => {
      if (linkEl.dataset.navLink === currentPage) {
        linkEl.setAttribute('aria-current', 'page');
      } else {
        linkEl.removeAttribute('aria-current');
      }
    });
  }

  function applyFetchedDocument(nextDocument) {
    const nextMain = nextDocument.querySelector('[data-page-content]');
    if (!nextMain) {
      throw new Error('Page content missing');
    }

    const currentMain = document.querySelector('[data-page-content]');
    const nextDescription = nextDocument.querySelector('meta[name="description"]');
    const currentDescription = document.querySelector('meta[name="description"]');

    currentPageCleanup();
    currentPageCleanup = () => {};

    if (currentMain) {
      currentMain.replaceWith(nextMain);
    }

    if (nextDescription && currentDescription) {
      currentDescription.setAttribute('content', nextDescription.getAttribute('content') || '');
    }

    if (nextDocument.title) {
      document.title = nextDocument.title;
    }

    document.body.dataset.page = nextMain.dataset.page || '';
    syncNav();
    currentPageCleanup = hydratePage(nextMain);
    scheduleChromeSync();
  }

  async function loadPage(url, { push = false } = {}) {
    const targetUrl = new URL(url, window.location.href);

    if (window.location.protocol === 'file:') {
      window.location.href = targetUrl.href;
      return;
    }

    const token = ++navigationToken;
    document.body.classList.add('is-navigating');

    try {
      const response = await fetch(targetUrl.href, {
        headers: {
          'X-Requested-With': 'fetch',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load ${targetUrl.pathname}`);
      }

      const html = await response.text();
      if (token !== navigationToken) return;

      const parser = new DOMParser();
      const nextDocument = parser.parseFromString(html, 'text/html');
      applyFetchedDocument(nextDocument);

      if (push) {
        window.history.pushState({ path: targetUrl.href }, '', targetUrl.href);
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.getElementById('mainContent')?.focus({ preventScroll: true });
    } catch (error) {
      window.location.href = targetUrl.href;
      return;
    } finally {
      if (token === navigationToken) {
        document.body.classList.remove('is-navigating');
      }
    }
  }

  document.addEventListener('click', (event) => {
    const linkEl = event.target.closest('[data-page-link]');
    if (!linkEl) return;

    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return;
    }

    event.preventDefault();
    loadPage(linkEl.href, { push: true });
  });

  window.addEventListener('popstate', () => {
    loadPage(window.location.href, { push: false });
  });

  document.body.dataset.page = document.querySelector('[data-page-content]')?.dataset.page || document.body.dataset.page || '';
  syncNav();
  currentPageCleanup = hydratePage(document.querySelector('[data-page-content]'));
  scheduleChromeSync();
})();
