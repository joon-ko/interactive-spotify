// use savedData when changing axes so you don't have to call the spotify api again
let savedData = null

// audio object to play 30s preview mp3
let audio = new Audio()
let timeout = null

// either 'top' for top 25, or 'playlist' for a user playlist
let selected = 'top'

function audioFadeIn(audio) {
  audio.pause()
  audio.currentTime = 0
  audio.play()

  let volume = 0
  let interval = setInterval(function() {
    volume += 0.05
    if (volume >= 1) clearInterval(interval)
    else audio.volume = volume
  }, 1000/20);
}

const width = 1200
const height = 950
const margin = ({top: 10, right: 70, bottom: 40, left: 50})

// most audio features use a 0,1 domain, luckily
const x = d3.scaleLinear()
  .domain([0, 1])
  .range([margin.left, width - margin.right])
const y = d3.scaleLinear()
  .domain([0, 1])
  .range([height - margin.bottom, margin.top])

const s = d3.scaleLinear()
  .domain([0, 24])
  .range([100, 40])

// fill in playlist names
function fillPlaylists() {
  axios.get('/playlists')
    .then(function (response) {
      if (response.data['error'] !== undefined) {
        alert(response.data['error']);
      } else {
        let playlists = response.data
        d3.select('#playlist-select')
          .selectAll('option')
            .data(playlists)
          .enter()
            .append('option')
          .text(p => p.name)
          .attr('value', p => p.id)
      }
    })
}
fillPlaylists()

function displayInfo(d, xField, yField) {
  // rename 'valence' to more meaningful 'positivity'
  xFieldName = (xField === 'valence') ? 'positivity' : xField
  yFieldName = (yField === 'valence') ? 'positivity' : yField

  document.getElementById('info').innerHTML = `
    <div><b>${d.track.name}</b></div>
    <div><b>artist:</b> ${getArtists(d.track.artists)}</div>
    <div><b>album:</b> ${d.track.album.name}</div>
    <div><b>length:</b> ${formatTime(d.track.duration_ms)}</div>
    <div><b>global popularity:</b> ${d.track.popularity}</div>
    <br>
    <div><b>${yFieldName}:</b> ${d[yField]}</div>
    <div><b>${xFieldName}:</b> ${d[xField]}</div>
  `
}

d3.select('#playlist-select').on('change', function() {
  let playlist = d3.select(this).property('value')
  if (playlist === 'top25') {
    document.getElementById('time-range-container').style.visibility = 'visible'
    let time_range = d3.select('#time-range-select').property('value')
    let xField = d3.select('#x-axis-select').property('value')
    let yField = d3.select('#y-axis-select').property('value')
    selected = 'top'
    renderTop(time_range, xField, yField)
  } else {
    document.getElementById('time-range-container').style.visibility = 'hidden'
    let xField = d3.select('#x-axis-select').property('value')
    let yField = d3.select('#y-axis-select').property('value')
    selected = 'playlist'
    renderPlaylist(playlist, xField, yField)
  }
})

d3.select('#time-range-select').on('change', function() {
  let time_range = d3.select(this).property('value')
  let xField = d3.select('#x-axis-select').property('value')
  let yField = d3.select('#y-axis-select').property('value')
  renderTop(time_range, xField, yField)
})

d3.select('#x-axis-select').on('change', function() {
  let xField = d3.select(this).property('value')
  let yField = d3.select('#y-axis-select').property('value')
  render(xField, yField)
})

d3.select('#y-axis-select').on('change', function() {
  let xField = d3.select('#x-axis-select').property('value')
  let yField = d3.select(this).property('value')
  render(xField, yField)
})

function formatTime(ms) {
  let total_seconds = Math.floor(ms / 1000)
  let min = Math.floor(total_seconds / 60)
  let secs = total_seconds % 60
  let pad = (secs < 10) ? '0' : ''
  return `${min}:${pad}${secs}`
}

function getArtists(list) {
  let names = list.map(a => a.name)
  return names.join(', ')
}

function renderPlaylist(playlist, xField, yField) {
  axios.get(`/playlist?id=${playlist}`)
    .then(function (response) {
      let trackData = response.data['audio_features']
      for (let i=0; i<trackData.length; i++) {
        trackData[i].index = i
      }

      savedData = trackData
      render(xField, yField)
    })
}

function renderTop(time_range, xField, yField) {
  axios.get(`/top?time_range=${time_range}`)
    .then(function (response) {
      let trackData = response.data['audio_features']
      for (let i=0; i<trackData.length; i++) {
        trackData[i].index = i
      }

      savedData = trackData
      render(xField, yField)
    })
}

function render(xField, yField) {
  let list = d3.select('div#list')

  // clear list
  list.selectAll('div').remove()

  list.selectAll('div')
    .data(savedData)
    .join('div')
      .text(d => `${d.index + 1}. ${d.track.name}`)

  list.selectAll('div')
    .data(savedData)
    .on('mouseover', function(d) {
      d3.select(this).style('color', 'blue');
      d3.select('use')
        .attr('xlink:href', `#i-${d.index}`)
      d3.selectAll('image')
        .attr('opacity', 0.3)
      d3.select(`image#i-${d.index}`)
        .transition()
          .duration(200)
          .ease(d3.easeLinear)
        .attr('width', d => selected === 'top' ? s(d.index) + 30 : 80)
        .attr('height', d => selected === 'top' ? s(d.index) + 30 : 80)
        .attr('x', d => x(d[xField]) - (selected === 'top' ? ((s(d.index) + 30)/2) : 40))
        .attr('y', d => y(d[yField]) - (selected === 'top' ? ((s(d.index) + 30)/2) : 40))
        .attr('opacity', 1.0)
      displayInfo(d, xField, yField)

      if (timeout !== null) clearTimeout(timeout)
      audio.volume = 0
      audio.src = d.track.preview_url
      timeout = setTimeout(audioFadeIn, 500, audio)
    })
    .on('mouseout', function(d) {
      d3.select(this).style('color', 'black')
      d3.select(`image#i-${d.index}`)
        .transition()
          .duration(200)
          .ease(d3.easeLinear)
        .attr('width', d => selected === 'top' ? s(d.index) : 50)
        .attr('height', d => selected === 'top' ? s(d.index) : 50)
        .attr('x', d => x(d[xField]) - (selected === 'top' ? (s(d.index)/2) : 25))
        .attr('y', d => y(d[yField]) - (selected === 'top' ? (s(d.index)/2) : 25))
      d3.selectAll('image')
        .attr('opacity', 1.0)
      document.getElementById('info').innerHTML = ''
    })

  list.on('mouseout', function(d) {
    if (timeout !== null) clearTimeout(timeout)
    audio.pause()
  })

  let plot = d3.select('svg#plot')
    .attr('width', width)
    .attr('height', height)

  // clear plot
  plot.selectAll('g').remove()
  plot.selectAll('use').remove()

  // rename 'valence' to more meaningful 'positivity'
  xFieldName = (xField === 'valence') ? 'positivity' : xField
  yFieldName = (yField === 'valence') ? 'positivity' : yField

  // plot axes
  plot.append('g')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .append('text')
      .attr('fill', '#000')
      .attr('transform', 'rotate(0)')
      .attr('y', margin.bottom)
      .attr('x', (width + margin.left)/2)
      .attr('dy', '-0.5em')
      .attr('font-size', 12)
      .attr('text-anchor', 'middle')
      .text(`${xFieldName}`)
  plot.append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y))
    .append('text')
      .attr('fill', '#000')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left/2)
      .attr('x', -height/2)
      .attr('dy', '-1em')
      .attr('font-size', 12)
      .attr('text-anchor', 'middle')
      .text(`${yFieldName}`)

  plot.append('g')
      .attr('id', 'points')
    .selectAll('image')
    .data(savedData)
    .join('image')
      .attr('id', d => `i-${d.index}`)
      .attr('href', d => d.track.album.images[0].url)
      .attr('x', d => x(d[xField]) - (selected === 'top' ? (s(d.index)/2) : 25))
      .attr('y', d => y(d[yField]) - (selected === 'top' ? (s(d.index)/2) : 25))
      .attr('width', d => selected === 'top' ? s(d.index) : 50)
      .attr('height', d => selected === 'top' ? s(d.index) : 50)

  // used to bring currently highlighted track to front
  plot.append('use')
    .attr('xlink:href', '#i-0')
}

renderTop('medium_term', 'energy', 'danceability')