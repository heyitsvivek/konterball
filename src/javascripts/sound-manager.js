import {Howler, Howl} from 'howler';
import $ from 'zepto-modules';
import {rand, cap} from './util/helpers';
import {MODE} from './constants';

/* eslint-disable */

export default class SoundManager {
  constructor(config) {
    this.config = config;
    this.muted = false;
    this.paddleSounds = [];
    this.tableSounds = [];
    let url = 'https://s3.eu-central-1.amazonaws.com/pingpongsound/menu/';
    for (let i = 1; i <= 3; i += 1) {
      this.paddleSounds.push(new Howl({
        src: `${url}racket0${i}.mp3`,
      }));
      this.tableSounds.push(new Howl({
        src: `${url}table0${i}.mp3`,
      }));
    }
    this.uiSounds = new Map();
    this.uiSounds.set('button', new Howl({
      src: `${url}button.mp3`,
      onloaderror: () => {
        console.warn('Error loading sound');
        this.error = true;
      },
    }));
    this.uiSounds.set('joined', new Howl({src: `${url}joined.mp3`}));
    this.uiSounds.set('touch', new Howl({src: `${url}touch.mp3`}));
    this.uiSounds.set('transition', new Howl({src: `${url}transition.mp3`}));

    this.uiSounds.set('lose', new Howl({src: `${url}lose.mp3`}));
    this.uiSounds.set('win', new Howl({src: `${url}win.mp3`}));
    this.uiSounds.set('miss', new Howl({src: `${url}miss.mp3`}));
    this.uiSounds.set('point', new Howl({src: `${url}point.mp3`}));
    this.uiSounds.set('net', new Howl({src: `${url}net.mp3`}));
    this.uiSounds.set('type', new Howl({src: `${url}type.mp3`}));

    url = 'https://s3.eu-central-1.amazonaws.com/pingpongsound/loops/';
    this.loopSounds = new Map();
    this.loopSounds.set('bass', new Howl({
      loop: true,
      src: `${url}loop1-bass.mp3`,
      onload: () => {
        this.loopSounds.get('bass').play();
      },
    }));
    this.loopSounds.set('bass-pad', new Howl({loop: true, src: `${url}loop1-bass-pad.mp3`}));
    this.loopSounds.set('bass-pad-synth', new Howl({loop: true, src: `${url}loop1-bass-pad-synth.mp3`}));
    this.loopSounds.set('waiting', new Howl({loop: true, src: `${url}waiting.mp3`}));
    if (localStorage.muted === 'true') {
      this.mute();
    }
  }

  playLoop(keyLoop) {
    if (this.error) return;
    let pos = 0;
    this.loopSounds.forEach((sound, key) => {
      if (this.loopSounds.get(key).playing()) {
        pos = this.loopSounds.get(key).seek();
        this.loopSounds.get(key).stop();
      }
    });
    this.loopSounds.get(keyLoop).seek(pos);
    this.loopSounds.get(keyLoop).play();
  }

  playUI(id) {
    if (this.error) return;
    this.uiSounds.get(id).play();
  }

  paddle(point = {x: 0, y: 0, z: 0}) {
    if (this.error) return;
    const i = rand(0, this.paddleSounds.length);
    this.paddleSounds[i].pos(point.x, point.y, point.z);
    this.paddleSounds[i].play();
  }

  table(point = {x: 0, y: 0, z: 0}, velocity = {x: 0, y: -1, z: -1}) {
    if (this.error) return;
    if (point.y > this.config.tableHeight + 0.1 && this.config.mode === MODE.MULTIPLAYER) {
      // ball hit vertical table but its not visible
      return;
    }
    const i = rand(0, this.tableSounds.length);
    this.tableSounds[i].pos(point.x, point.y, point.z);
    if (point.y > this.config.tableHeight + 0.1) {
      // ball hit vertical table half, use z velocity as volume
      this.tableSounds[i].volume(cap(velocity.z * -0.5, 0, 1));
    } else {
      // ball hit horizontal table, use y velocity as volume
      this.tableSounds[i].volume(cap(velocity.y * -0.5, 0, 1));
    }
    this.tableSounds[i].play();
  }

  toggleMute() {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  // eslint-disable-next-line
  blur() {
    Howler.mute(true);
  }

  focus() {
    if (!this.muted) {
      Howler.mute(false);
    }
  }

  mute() {
    $('.mute img').attr('src', 'images/icon-mute.svg');
    localStorage.muted = 'true';
    Howler.mute(true);
    this.muted = true;
  }

  unmute() {
    $('.mute img').attr('src', 'images/icon-unmute.svg');
    localStorage.muted = 'false';
    Howler.mute(false);
    this.muted = false;
  }
}
