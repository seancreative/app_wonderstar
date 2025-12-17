export function cleanInvalidCookies() {
  try {
    const cookies = document.cookie.split(';');

    for (const cookie of cookies) {
      const [name, value] = cookie.split('=').map(part => part.trim());

      if (!name || !value) continue;

      try {
        if (value.length > 0) {
          atob(value);
        }
      } catch (error) {
        console.warn(`Removing invalid base64 cookie: ${name}`);
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    }
  } catch (error) {
    console.error('Error cleaning cookies:', error);
  }
}

export function validateCookieValue(value: string): boolean {
  try {
    if (!value || value.length === 0) return false;

    atob(value);
    return true;
  } catch {
    return false;
  }
}

export function safeDecode(encodedValue: string): string | null {
  try {
    if (!validateCookieValue(encodedValue)) {
      return null;
    }
    return atob(encodedValue);
  } catch {
    return null;
  }
}
