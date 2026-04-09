const downloadExcel = async () => {
  try {
    const token = useCookie('token').value;
    const response = await fetch('/api/documents/export-document', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to download the Excel file');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    // Trigger file download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'documents.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading Excel file:', error.message);
  }
};

export default downloadExcel;
