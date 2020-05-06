// use savedData when changing axes so you don't have to call the spotify api again
let savedData = null

// audio object to play 30s preview mp3
let audio = new Audio()
let timeout = null

// either 'top' for top 25, or 'playlist' for a user playlist
let selected = 'top'

// for bringing the current hovered element to the front
let currentlySelected = 0

function audioFadeIn(audio) {
  audio.pause()
  audio.currentTime = 0
  audio.play()

  let volume = 0
  let interval = setInterval(function() {
    volume += 0.05
    if (volume >= 0.5) clearInterval(interval)
    else audio.volume = volume
  }, 1000/40);
}

let width = 0.6 * window.innerWidth
let height = 0.9 * window.innerHeight
const margin = ({top: 40, right: 70, bottom: 40, left: 50})

// most audio features use a 0,1 domain, luckily
let x = d3.scaleLinear()
  .domain([0, 1])
  .range([margin.left, width - margin.right])
let y = d3.scaleLinear()
  .domain([0, 1])
  .range([height - margin.bottom, margin.top])
let s = d3.scaleLinear()
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
    <div style="color: #1db954;"><b>${d.track.name}</b></div>
    <div><b>artist:</b> ${getArtists(d.track.artists)}</div>
    <div><b>album:</b> ${d.track.album.name}</div>
    <div><b>length:</b> ${formatTime(d.track.duration_ms)}</div>
    <div><b>global popularity:</b> ${d.track.popularity}</div>
    <br>
    <div><b>${yFieldName}:</b> ${d[yField]}</div>
    <div><b>${xFieldName}:</b> ${d[xField]}</div>
  `
}

function showAverages(data) {
  count = data.length
  fields = [
    'energy', 'danceability', 'valence', 'acousticness', 'instrumentalness', 'liveness', 'speechiness'
  ]
  averages = new Map()
  for (let i=0; i<fields.length; i++) {
    let sum = 0
    data.forEach(d => sum += d[fields[i]])
    let average = Math.round((sum / count) * 1000) / 1000
    averages.set(fields[i], average)
  }

  document.getElementById('avgs').innerHTML = `
    <div style="color: #1db954;"><b>playlist averages</b></div>
    <ul style="margin: 5px 0 5px 0;">
      <li><b>energy:</b> ${averages.get('energy')}</li>
      <li><b>danceability:</b> ${averages.get('danceability')}</li>
      <li><b>positivity:</b> ${averages.get('valence')}</li>
      <li><b>acousticness:</b> ${averages.get('acousticness')}</li>
      <li><b>instrumentalness:</b> ${averages.get('instrumentalness')}</li>
      <li><b>liveness:</b> ${averages.get('liveness')}</li>
      <li><b>speechiness:</b> ${averages.get('speechiness')}</li>
    </ul>
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

// resize axes dynamically
window.addEventListener('resize', () => {
  width = 0.6 * window.innerWidth
  height = 0.9 * window.innerHeight
  x = d3.scaleLinear()
    .domain([0, 1])
    .range([margin.left, width - margin.right])
  y = d3.scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top])
  let xField = d3.select('#x-axis-select').property('value')
  let yField = d3.select('#y-axis-select').property('value')
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
      if (response.data['error'] !== undefined) {
        alert(response.data['error']);
      } else {
        let trackData = response.data['audio_features']
        for (let i=0; i<trackData.length; i++) {
          trackData[i].index = i
        }

        savedData = trackData
        showAverages(savedData)
        render(xField, yField)
      }
    })
}

function renderTop(time_range, xField, yField) {
  axios.get(`/top?time_range=${time_range}`)
    .then(function (response) {
      if (response.data['error'] !== undefined) {
        alert(response.data['error']);
      } else {
        let trackData = response.data['audio_features']
        for (let i=0; i<trackData.length; i++) {
          trackData[i].index = i
        }

        savedData = trackData
        showAverages(savedData)
        render(xField, yField)
      }
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
      .attr('id', d => `l-${d.index}`)

  list.selectAll('div')
    .data(savedData)
    .on('mouseover', function(d) {
      d3.select(this).style('color', '#1db954');
      d3.selectAll('image')
        .attr('opacity', 0.3)

      reinsertImage(d.index, xField, yField)
      expandImage(d, xField, yField)
      displayInfo(d, xField, yField)

      if (timeout !== null) clearTimeout(timeout)
      audio.volume = 0
      if (d.track.preview_url !== null) {
        audio.src = d.track.preview_url
        timeout = setTimeout(audioFadeIn, 500, audio)
      }
    })
    .on('mouseout', function(d) {
      d3.select(this).style('color', '#fff')
      contractImage(d, xField, yField)
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
      .attr('fill', '#fff')
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
      .attr('fill', '#fff')
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

  d3.select('g#points').selectAll('image')
    .data(savedData)
    .on('mouseover', function(d) {
      d3.select(`div#l-${d.index}`).style('color', '#1db954');
      d3.selectAll('image')
        .attr('opacity', 0.3)

      reinsertImage(d.index, xField, yField)
      expandImage(d, xField, yField)
      displayInfo(d, xField, yField)

      if (timeout !== null) clearTimeout(timeout)
      audio.volume = 0
      if (d.track.preview_url !== null) {
        audio.src = d.track.preview_url
        timeout = setTimeout(audioFadeIn, 500, audio)
      }
    })
    .on('mouseout', function(d) {
      d3.select(`div#l-${d.index}`).style('color', '#fff');
      contractImage(d, xField, yField)
      document.getElementById('info').innerHTML = ''

      if (timeout !== null) clearTimeout(timeout)
      audio.pause()
    })
}

function expandImage(d, xField, yField) {
  d3.select(`image#i-${d.index}`)
    .transition()
      .duration(200)
      .ease(d3.easeLinear)
    .attr('width', selected === 'top' ? s(d.index) + 30 : 80)
    .attr('height', selected === 'top' ? s(d.index) + 30 : 80)
    .attr('x', x(d[xField]) - (selected === 'top' ? ((s(d.index) + 30)/2) : 40))
    .attr('y', y(d[yField]) - (selected === 'top' ? ((s(d.index) + 30)/2) : 40))
    .attr('opacity', 1.0)
}

function contractImage(d, xField, yField) {
  d3.select(`image#i-${d.index}`)
    .transition()
      .duration(200)
      .ease(d3.easeLinear)
    .attr('width', selected === 'top' ? s(d.index) : 50)
    .attr('height', selected === 'top' ? s(d.index) : 50)
    .attr('x', x(d[xField]) - (selected === 'top' ? (s(d.index)/2) : 25))
    .attr('y', y(d[yField]) - (selected === 'top' ? (s(d.index)/2) : 25))
  d3.selectAll('image')
    .attr('opacity', 1.0)
}

function reinsertImage(index, xField, yField) {
  let d = savedData[index]
  d3.select(`image#i-${d.index}`).remove()
  d3.select('g#points').append('image')
    .attr('id', `i-${d.index}`)
    .attr('href', d.track.album.images[0].url)
    .attr('x', x(d[xField]) - (selected === 'top' ? (s(d.index)/2) : 25))
    .attr('y', y(d[yField]) - (selected === 'top' ? (s(d.index)/2) : 25))
    .attr('width', selected === 'top' ? s(d.index) : 50)
    .attr('height', selected === 'top' ? s(d.index) : 50)
    .on('mouseover', () => {
      d3.select(`div#l-${index}`).style('color', '#1db954');
      d3.selectAll('image')
        .attr('opacity', 0.3)

      if (currentlySelected !== index) {
        currentlySelected = index
        reinsertImage(index, xField, yField)
      }
      expandImage(d, xField, yField)
      displayInfo(d, xField, yField)

      if (timeout !== null) clearTimeout(timeout)
      audio.volume = 0
      if (d.track.preview_url !== null) {
        audio.src = d.track.preview_url
        timeout = setTimeout(audioFadeIn, 500, audio)
      }
    })
    .on('mouseout', () => {
      d3.select(`div#l-${index}`).style('color', '#fff');
      contractImage(d, xField, yField)
      document.getElementById('info').innerHTML = ''

      if (timeout !== null) clearTimeout(timeout)
      audio.pause()
    })
}

renderTop('medium_term', 'energy', 'danceability')