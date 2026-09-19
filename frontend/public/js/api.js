// API Request Helper Module
export async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    return data;
  } catch (err) {
    throw err;
  }
}
