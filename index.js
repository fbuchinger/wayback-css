'use strict'
const got = require('got')
const cheerio = require('cheerio')
const getInline = require('get-inline-styles')
const stripComments = require('strip-html-comments')
const stripWayback = require('strip-wayback-toolbar')

module.exports = (url, timestamp) => {
  let waybackUrl = null

  return getAvailableUrl(url, timestamp)
    .then(url => waybackUrl = url && got(url))
    .then(res => stripWayback(res.body))
    .then(getCss)
    .then(getCssFromLinks)
    .then(aggregateCss)
}

const aggregateCss = css => {
  css.css = css.links.concat(css.styles).join(' ')

  return css
}

const getCssFromLinks = css => {
  const baseUrl = 'http://web.archive.org'
  const linkCss = []

  const px = css.links.map(link => {
    const loc = /^http/.test(link) ? link : `${baseUrl}${link}`
    console.log(loc)

    return got(loc).then(res => linkCss.push(res.body))
  })

  return Promise.all(px)
    .then(() => ({
      styles: css.styles,
      inline: css.inline,
      links: linkCss
    }))
}

const getCss = html => {
  const $ = cheerio.load(html)

  const results = {
    html,
    links: [],
    styles: [],
    inline: getInline(html)
  }

  $('style').each(function () {
    results.styles.push(stripComments($(this).text()))
  })

  $('link[rel=stylesheet]').each(function () {
    results.links.push($(this).attr('href'))
  })

  return results
}

const getAvailableUrl = (url, timestamp) => {
  const availabilityUrl = `http://archive.org/wayback/available?url=${url}&timestamp=${timestamp}`

  return got(availabilityUrl, { json: true })
    .then(res => res.body.archived_snapshots.closest)
    .then(closest => closest.available && closest.url)
}
