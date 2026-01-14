window.ResultsRenderer = (function () {
  function renderResultsTable(findings, htmlText, container) {
    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Rule</th>
          <th>Impact</th>
          <th>Description</th>
          <th>Occurrences</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    findings.forEach(v => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${v.id || '—'}</td>
        <td>${v.impact || 'minor'}</td>
        <td>${v.description || ''}</td>
        <td style="text-align:center;">${(v.nodes && v.nodes.length) || 0}</td>
      `;
      tbody.appendChild(tr);
    });

    container.appendChild(table);
  }

  return {
    renderResultsTable
  };
})();

