/**
 * Notification sound utility using Web Audio API
 * Generates notification sounds without requiring external audio files
 */

class NotificationSound {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Play a pleasant notification sound
   * Uses a sequence of tones to create an alert sound
   */
  playNotification(): void {
    try {
      const context = this.getAudioContext();
      const now = context.currentTime;

      // First tone - 800Hz
      this.playTone(context, 800, now, 0.15, 0.3);

      // Second tone - 1000Hz
      this.playTone(context, 1000, now + 0.15, 0.15, 0.3);

      // Third tone - 1200Hz
      this.playTone(context, 1200, now + 0.3, 0.25, 0.4);
    } catch (error) {
      console.warn('Unable to play notification sound:', error);
    }
  }

  /**
   * Play a success sound (higher pitched, single tone)
   */
  playSuccess(): void {
    try {
      const context = this.getAudioContext();
      const now = context.currentTime;

      this.playTone(context, 1200, now, 0.1, 0.2);
      this.playTone(context, 1500, now + 0.1, 0.2, 0.3);
    } catch (error) {
      console.warn('Unable to play success sound:', error);
    }
  }

  /**
   * Play an error sound (lower pitched)
   */
  playError(): void {
    try {
      const context = this.getAudioContext();
      const now = context.currentTime;

      this.playTone(context, 400, now, 0.2, 0.3);
      this.playTone(context, 300, now + 0.2, 0.3, 0.4);
    } catch (error) {
      console.warn('Unable to play error sound:', error);
    }
  }

  private playTone(
    context: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    volume: number
  ): void {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    // Smooth envelope to avoid clicks
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }
}

export const notificationSound = new NotificationSound();
