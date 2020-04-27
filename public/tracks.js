axios.get('/top')
  .then(function (response) {
    let trackData = response.data['audio_features']
    for (let i=0; i<trackData.length; i++) {
      trackData[i].index = i
    }

    let list = d3.select('div#list')

    list.selectAll('div')
      .data(trackData)
      .join('div')
        .text(d => `${d.index + 1}. ${d.track.name}`)

    list.selectAll('div')
      .data(trackData)
      .on('mouseover', function(d) {
        d3.select(this).style('color', 'blue');
        d3.select('use')
          .attr('xlink:href', `#i-${d.index}`)
        d3.selectAll('image')
          .attr('opacity', 0.3)
        d3.select(`image#i-${d.index}`)
          .attr('width', d => s(d.index) + 20)
          .attr('height', d => s(d.index) + 20)
          .attr('x', d => x(d.energy) - ((s(d.index) + 20)/2))
          .attr('y', d => y(d.danceability) - ((s(d.index) + 20)/2))
          .attr('opacity', 1.0)
      })
      .on('mouseout', function(d) {
        d3.select(this).style('color', 'black');
        d3.select(`image#i-${d.index}`)
          .attr('width', d => s(d.index))
          .attr('height', d => s(d.index))
          .attr('x', d => x(d.energy) - (s(d.index)/2))
          .attr('y', d => y(d.danceability) - (s(d.index)/2))
        d3.selectAll('image')
          .attr('opacity', 1.0)
      })

    console.log(trackData)

    const width = 1200
    const height = 950
    const margin = ({top: 10, right: 70, bottom: 40, left: 50})

    let plot = d3.select('svg#plot')
      .attr('width', width)
      .attr('height', height)

    // energy
    const x = d3.scaleLinear()
      .domain([0, 1])
      .range([margin.left, width - margin.right])

    // danceability
    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([height - margin.bottom, margin.top])

    const s = d3.scaleLinear()
      .domain([0, 49])
      .range([100, 30])

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
        .text('energy');
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
        .text('danceability');

    plot.append('g')
      .selectAll('image')
      .data(trackData)
      .join('image')
        .attr('id', d => `i-${d.index}`)
        .attr('href', d => d.track.album.images[0].url)
        .attr('x', d => x(d.energy) - (s(d.index)/2))
        .attr('y', d => y(d.danceability) - (s(d.index)/2))
        .attr('width', d => s(d.index))
        .attr('height', d => s(d.index))

    plot.append('use')
      .attr('xlink:href', '#i-0')
  });