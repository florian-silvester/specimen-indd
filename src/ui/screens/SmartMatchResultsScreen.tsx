import { h, Fragment } from "preact";
import { useState, useEffect } from "preact/hooks";

export function SmartMatchResultsScreen(props: any) {
  const { mappedStyles, onApply } = props;
  const [headlineWeight, setHeadlineWeight] = useState('Regular');

  return (
    <div class="main-content">
      <h2>Smart Match Results</h2>
      <p>The following styles have been automatically matched to the Relume system. You can now adjust the weight for the headlines.</p>
      
      <div>
        <label for="headline-weight">Headline Weight:</label>
        <select
          id="headline-weight"
          value={headlineWeight}
          onChange={(e: any) => setHeadlineWeight(e.currentTarget.value)}
        >
          <option value="Light">Light</option>
          <option value="Regular">Regular</option>
          <option value="Medium">Medium</option>
          <option value="Semi Bold">Semi Bold</option>
          <option value="Bold">Bold</option>
          <option value="Extra Bold">Extra Bold</option>
        </select>
      </div>

      <button onClick={() => onApply(headlineWeight)}>Apply Styles</button>

      {/* For debugging, show the mapped styles */}
      <pre>{JSON.stringify(mappedStyles, null, 2)}</pre>
    </div>
  );
} 