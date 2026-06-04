import { useState, useEffect, useCallback } from 'react';
import { getTrainsBetweenStations, getStationList, type Train, type Station } from '../services/trainApi';
import './BestTrain.css';
function getTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function BestTrain() {
  const [fromStation, setFromStation] = useState<string>('');
  const [toStation, setToStation] = useState<string>('');
  const [fromSearch, setFromSearch] = useState<string>('');
  const [toSearch, setToSearch] = useState<string>('');
  const [fromSuggestions, setFromSuggestions] = useState<Station[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Station[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [nearbyTrains, setNearbyTrains] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showFromSuggestions, setShowFromSuggestions] = useState<boolean>(false);
  const [showToSuggestions, setShowToSuggestions] = useState<boolean>(false);
  const [originalFromStation, setOriginalFromStation] = useState<string>('');
  const [originalToStation, setOriginalToStation] = useState<string>('');
  const [expandedNearbyGroups, setExpandedNearbyGroups] = useState<Set<number>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocal);
  const [sortBy, setSortBy] = useState<'duration' | 'departure_time' | 'arrival_time'>('duration');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [touchedFields, setTouchedFields] = useState<{ from: boolean; to: boolean }>({ from: false, to: false });
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [stationsLoading, setStationsLoading] = useState<boolean>(true);

  // Load all stations once on page load
  useEffect(() => {
    const loadAllStations = async () => {
      try {
        setStationsLoading(true);
        const response = await getStationList({ skip: 0, limit: 20000 });
        setAllStations(response.data.stationList);
      } catch (err) {
        console.error('Error loading stations:', err);
      } finally {
        setStationsLoading(false);
      }
    };
    loadAllStations();
  }, []);

  // Frontend station search
  const searchStations = useCallback((query: string, setSuggestions: (stations: Station[]) => void) => {
    if (!query || query.length < 2 || stationsLoading) {
      setSuggestions([]);
      return;
    }

    const searchLower = query.toLowerCase().trim();
    const filtered = allStations
      .filter((station) => {
        const nameMatch = station.name.toLowerCase().includes(searchLower);
        const codeMatch = station.code.toLowerCase().includes(searchLower);
        return nameMatch || codeMatch;
      })
      .slice(0, 10); // Limit to 10 results

    setSuggestions(filtered);
  }, [allStations, stationsLoading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showFromSuggestions) {
        searchStations(fromSearch, setFromSuggestions);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [fromSearch, showFromSuggestions, searchStations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showToSuggestions) {
        searchStations(toSearch, setToSuggestions);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [toSearch, showToSuggestions, searchStations]);

  const handleSearchTrains = async () => {
    // Mark fields as touched
    setTouchedFields({ from: true, to: true });

    // Clear station codes if inputs are empty
    if (!fromSearch.trim()) {
      setFromStation('');
    }
    if (!toSearch.trim()) {
      setToStation('');
    }

    // Validate that both stations are selected
    if (!fromStation || !toStation || !fromSearch.trim() || !toSearch.trim()) {
      setError('Please select both from and to stations');
      return;
    }

    if (fromStation === toStation) {
      setError('From and To stations must be different');
      return;
    }

    setLoading(true);
    setError(null);
    setTrains([]);
    setNearbyTrains([]);
    setExpandedNearbyGroups(new Set());
    setOriginalFromStation(fromStation.toUpperCase());
    setOriginalToStation(toStation.toUpperCase());
    setHasSearched(true);

    try {
      const response = await getTrainsBetweenStations({
        from: fromStation.toUpperCase(),
        to: toStation.toUpperCase(),
        date: selectedDate || undefined,
        limit: 20,
        sort: sortBy,
        order: sortOrder,
      });

      setTrains(response.data.trains);
      setNearbyTrains(response.data.nearby_trains || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trains');
      console.error('Error fetching trains:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFromSelect = (station: Station) => {
    setFromStation(station.code);
    setFromSearch(station.name);
    setShowFromSuggestions(false);
    setFromSuggestions([]);
    setTouchedFields(prev => ({ ...prev, from: true }));
    setError(null);
  };

  const handleToSelect = (station: Station) => {
    setToStation(station.code);
    setToSearch(station.name);
    setShowToSuggestions(false);
    setToSuggestions([]);
    setTouchedFields(prev => ({ ...prev, to: true }));
    setError(null);
  };

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A';
    return time.substring(0, 5); // HH:MM format
  };

  const formatDaysBadges = (runsOn: number[]) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return runsOn.map((run, index) => ({
      day: days[index],
      active: run === 1,
    }));
  };

  const parseDurationMinutes = (duration: string | null): number => {
    if (!duration) return Infinity;
    const parts = duration.split(':');
    if (parts.length === 2) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return hours * 60 + minutes;
    }
    return Infinity;
  };

  const getMinimumDurationTrain = (trains: Train[]): Train | null => {
    if (trains.length === 0) return null;
    return trains.reduce((min, train) => {
      const minDuration = parseDurationMinutes(min.duration);
      const trainDuration = parseDurationMinutes(train.duration);
      return trainDuration < minDuration ? train : min;
    });
  };

  const toggleNearbyGroup = (index: number) => {
    setExpandedNearbyGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="best-train-container">
      <div className="best-train-header">
        <h1>Find Best Train</h1>
        <p>Search for trains between stations</p>
      </div>

      <div className="search-section">
        <div className="station-inputs">
          <div className="input-group">
            <label htmlFor="from-station">
              From Station <span className="required-asterisk">*</span>
            </label>
            <div className="input-wrapper">
              <input
                id="from-station"
                type="text"
                placeholder="Enter station name or code"
                value={fromSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setFromSearch(value);
                  setShowFromSuggestions(true);
                  // Clear station code if input is cleared
                  if (!value.trim()) {
                    setFromStation('');
                  }
                }}
                onFocus={() => {
                  setShowFromSuggestions(true);
                  setTouchedFields(prev => ({ ...prev, from: true }));
                }}
                onBlur={() => setTouchedFields(prev => ({ ...prev, from: true }))}
                className={`station-input ${touchedFields.from && !fromStation ? 'error' : ''}`}
                required
              />
              {touchedFields.from && !fromStation && (
                <span className="field-error">This field is required</span>
              )}
              {showFromSuggestions && fromSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {fromSuggestions.map((station) => (
                    <button
                      key={station.code}
                      type="button"
                      className="suggestion-item"
                      onClick={() => handleFromSelect(station)}
                    >
                      <span className="suggestion-name">{station.name}</span>
                      <span className="suggestion-code">{station.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="swap-button-wrapper">
            <button
              type="button"
              className="swap-button"
              onClick={() => {
                const tempStation = fromStation;
                const tempSearch = fromSearch;
                setFromStation(toStation);
                setFromSearch(toSearch);
                setToStation(tempStation);
                setToSearch(tempSearch);
              }}
              aria-label="Swap stations"
            >
              ⇄
            </button>
          </div>

          <div className="input-group">
            <label htmlFor="to-station">
              To Station <span className="required-asterisk">*</span>
            </label>
            <div className="input-wrapper">
              <input
                id="to-station"
                type="text"
                placeholder="Enter station name or code"
                value={toSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setToSearch(value);
                  setShowToSuggestions(true);
                  // Clear station code if input is cleared
                  if (!value.trim()) {
                    setToStation('');
                  }
                }}
                onFocus={() => {
                  setShowToSuggestions(true);
                  setTouchedFields(prev => ({ ...prev, to: true }));
                }}
                onBlur={() => setTouchedFields(prev => ({ ...prev, to: true }))}
                className={`station-input ${touchedFields.to && !toStation ? 'error' : ''}`}
                required
              />
              {touchedFields.to && !toStation && (
                <span className="field-error">This field is required</span>
              )}
              {showToSuggestions && toSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {toSuggestions.map((station) => (
                    <button
                      key={station.code}
                      type="button"
                      className="suggestion-item"
                      onClick={() => handleToSelect(station)}
                    >
                      <span className="suggestion-name">{station.name}</span>
                      <span className="suggestion-code">{station.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="filter-options">
          <div className="filter-group">
            <label htmlFor="travel-date">Travel Date (Optional)</label>
            <input
              id="travel-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
              min={getTodayLocal()}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="sort-by">Sort By</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'duration' | 'departure_time' | 'arrival_time')}
              className="sort-select"
            >
              <option value="duration">Duration</option>
              <option value="departure_time">Departure Time</option>
              <option value="arrival_time">Arrival Time</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-order">Order</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="sort-select"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="search-button"
          onClick={handleSearchTrains}
          disabled={loading || !fromStation || !toStation}
        >
          {loading ? 'Searching...' : 'Search Trains'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {hasSearched && trains.length === 0 && nearbyTrains.length > 0 && fromStation && toStation && !loading && !error && (
        <div className="no-direct-trains-message">
          <p className="no-direct-title">No Direct Trains Found</p>
          <p className="no-direct-text">There are no direct trains between these stations. Please check the nearby station options below.</p>
        </div>
      )}

      {trains.length > 0 && (
        <>
          <div className="results-header">
            <h2>Direct Trains ({trains.length})</h2>
            {(selectedDate || sortBy !== 'duration' || sortOrder !== 'asc') && (
              <div className="active-filters">
                {selectedDate && (
                  <span className="filter-badge">
                    Date: {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                <span className="filter-badge">
                  Sort: {sortBy === 'duration' ? 'Duration' : sortBy === 'departure_time' ? 'Departure Time' : 'Arrival Time'} ({sortOrder === 'asc' ? 'Asc' : 'Desc'})
                </span>
              </div>
            )}
          </div>
          <div className="trains-list">
          {trains.map((train, index) => (
            <div key={`${train.train_number}-${index}`} className="train-card">
              <div className="train-header">
                <div className="train-number">{train.train_number}</div>
                <div className="train-name">{train.train_name}</div>
              </div>
              <div className="train-details">
                <div className="route-info">
                  <div className="route-item">
                    <span className="route-label">From:</span>
                    <span className="route-value">{train.from_station_name} ({train.from_station_code})</span>
                  </div>
                  <div className="route-item">
                    <span className="route-label">To:</span>
                    <span className="route-value">{train.to_station_name} ({train.to_station_code})</span>
                  </div>
                </div>
                <div className="time-info">
                  <div className="time-item">
                    <span className="time-label">Departure:</span>
                    <span className="time-value">{formatTime(train.departure_time)}</span>
                  </div>
                  <div className="time-item">
                    <span className="time-label">Arrival:</span>
                    <span className="time-value">{formatTime(train.arrival_time)}</span>
                  </div>
                  <div className="time-item">
                    <span className="time-label">Duration:</span>
                    <span className="time-value">{train.duration}</span>
                  </div>
                </div>
                <div className="train-meta">
                  <div className="runs-on-section">
                    <span className="runs-on-label">Runs on:</span>
                    <div className="days-badges">
                      {formatDaysBadges(train.runs_on).map(({ day, active }) => (
                        <span
                          key={day}
                          className={`day-badge ${active ? 'active' : 'inactive'}`}
                          title={active ? `Runs on ${day}` : `Does not run on ${day}`}
                        >
                          {day.substring(0, 1)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {train.distance_between && (
                    <span className="distance">{train.distance_between} km</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        </>
      )}

      {nearbyTrains.length > 0 && (
        <div className="nearby-trains-section">
          <h3>Nearby Station Options</h3>
          {nearbyTrains.map((nearby, index) => {
            const fromDistance = nearby.from_station.distance_km || 0;
            const toDistance = nearby.to_station.distance_km || 0;
            const isFromDifferent = nearby.from_station.code !== originalFromStation;
            const isToDifferent = nearby.to_station.code !== originalToStation;
            const isExpanded = expandedNearbyGroups.has(index);
            const trainCount = nearby.trains.length;
            const minDurationTrain = getMinimumDurationTrain(nearby.trains);

            return (
              <div key={index} className="nearby-group">
                <button
                  type="button"
                  className="nearby-header-button"
                  onClick={() => toggleNearbyGroup(index)}
                  aria-expanded={isExpanded}
                >
                  <div className="nearby-header-content">
                    <div className="nearby-route">
                      {nearby.from_station.name} ({nearby.from_station.code}) → {nearby.to_station.name} ({nearby.to_station.code})
                      <span className="train-count-badge">{trainCount} train{trainCount !== 1 ? 's' : ''}</span>
                      {minDurationTrain && (
                        <span className="min-duration-badge">
                          Fastest: {formatTime(minDurationTrain.departure_time)} - {formatTime(minDurationTrain.arrival_time)} ({minDurationTrain.duration})
                        </span>
                      )}
                    </div>
                    <div className="distance-badges">
                      {isFromDifferent && fromDistance > 0 && (
                        <span className="distance-badge distance-from-origin">
                          +{fromDistance} km from origin
                        </span>
                      )}
                      {isToDifferent && toDistance > 0 && (
                        <span className="distance-badge distance-to-destination">
                          +{toDistance} km from destination
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div className="nearby-trains-content">
                    <div className="trains-list">
                      {nearby.trains.map((train: Train, trainIndex: number) => (
                        <div key={`${train.train_number}-${trainIndex}`} className="train-card nearby-train">
                          <div className="train-header">
                            <div className="train-number">{train.train_number}</div>
                            <div className="train-name">{train.train_name}</div>
                          </div>
                          <div className="train-details">
                            <div className="route-info">
                              <div className="route-item">
                                <span className="route-label">From:</span>
                                <span className="route-value">{train.from_station_name} ({train.from_station_code})</span>
                              </div>
                              <div className="route-item">
                                <span className="route-label">To:</span>
                                <span className="route-value">{train.to_station_name} ({train.to_station_code})</span>
                              </div>
                            </div>
                            <div className="time-info">
                              <div className="time-item">
                                <span className="time-label">Departure:</span>
                                <span className="time-value">{formatTime(train.departure_time)}</span>
                              </div>
                              <div className="time-item">
                                <span className="time-label">Arrival:</span>
                                <span className="time-value">{formatTime(train.arrival_time)}</span>
                              </div>
                              <div className="time-item">
                                <span className="time-label">Duration:</span>
                                <span className="time-value">{train.duration}</span>
                              </div>
                            </div>
                        <div className="train-meta">
                          <div className="runs-on-section">
                            <span className="runs-on-label">Runs on:</span>
                            <div className="days-badges">
                              {formatDaysBadges(train.runs_on).map(({ day, active }) => (
                                <span
                                  key={day}
                                  className={`day-badge ${active ? 'active' : 'inactive'}`}
                                  title={active ? `Runs on ${day}` : `Does not run on ${day}`}
                                >
                                  {day.substring(0, 1)}
                                </span>
                              ))}
                            </div>
                          </div>
                          {train.distance_between && (
                            <span className="distance">{train.distance_between} km</span>
                          )}
                        </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasSearched && !loading && trains.length === 0 && nearbyTrains.length === 0 && fromStation && toStation && !error && (
        <div className="no-results">
          <p>No trains found between these stations.</p>
          <p className="no-results-hint">Try searching for nearby stations or different routes.</p>
        </div>
      )}
    </div>
  );
}
