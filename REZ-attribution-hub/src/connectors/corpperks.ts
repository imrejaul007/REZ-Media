// CorpPerks Connector
export async function getHRUser(employeeId: string): Promise<any> {
  const url = process.env.CORPPERKS_HR_URL || 'http://localhost:4100';
  const res = await fetch(`${url}/api/employees/${employeeId}`, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || 'dev' }
  });
  return res.json().catch(() => null);
}
