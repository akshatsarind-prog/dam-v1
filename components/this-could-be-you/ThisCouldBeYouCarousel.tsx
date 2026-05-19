'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ThisCouldBeYouStory } from './stories'

type ThisCouldBeYouCarouselProps = {
  stories: ThisCouldBeYouStory[]
  returnHref: string
}

export default function ThisCouldBeYouCarousel({
  stories,
  returnHref,
}: ThisCouldBeYouCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const trackRef = useRef<HTMLUListElement | null>(null)
  const cardRefs = useRef<Array<HTMLLIElement | null>>([])
  const viewedStoryIdsRef = useRef<Set<string>>(new Set())
  const itemCount = stories.length + 1

  function scrollToCard(index: number) {
    const boundedIndex = Math.min(Math.max(index, 0), itemCount - 1)
    cardRefs.current[boundedIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  function handleTrackKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollToCard(activeIndex + 1)
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollToCard(activeIndex - 1)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      scrollToCard(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      scrollToCard(itemCount - 1)
    }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)

        const mostVisibleEntry = visibleEntries[0]
        if (!mostVisibleEntry) {
          return
        }

        const nextIndex = Number(mostVisibleEntry.target.getAttribute('data-index'))
        if (Number.isFinite(nextIndex)) {
          setActiveIndex(nextIndex)
        }

        const storyId = mostVisibleEntry.target.getAttribute('data-story-id')
        if (!storyId) {
          return
        }

        const story = stories.find((item) => item.id === storyId)
        if (!story || viewedStoryIdsRef.current.has(story.id)) {
          return
        }

        viewedStoryIdsRef.current.add(story.id)
        // TODO: Track viewed story cards once frontend-only analytics hooks can be added without changing API event validation.
      },
      {
        root: trackRef.current,
        threshold: [0.55, 0.7, 0.9],
      }
    )

    const cards = cardRefs.current.filter(Boolean)
    cards.forEach((card) => {
      if (card) {
        observer.observe(card)
      }
    })

    return () => observer.disconnect()
  }, [stories])

  return (
    <section
      className="story-carousel-section section-frame"
      aria-labelledby="this-could-be-you-carousel-title"
    >
      <div className="story-carousel-header">
        <div>
          <p className="system-label">
            <span aria-hidden="true" />
            Menu-only product experience
          </p>
          <h2 id="this-could-be-you-carousel-title">Quiet stories. Familiar mistakes.</h2>
        </div>
        <div className="story-carousel-controls" aria-label="Story navigation controls">
          <button
            type="button"
            className="story-carousel-control"
            onClick={() => scrollToCard(activeIndex - 1)}
            disabled={activeIndex === 0}
          >
            Previous
          </button>
          <span className="story-carousel-progress" aria-live="polite">
            {Math.min(activeIndex + 1, itemCount)}/{itemCount}
          </span>
          <button
            type="button"
            className="story-carousel-control"
            onClick={() => scrollToCard(activeIndex + 1)}
            disabled={activeIndex === itemCount - 1}
          >
            Next
          </button>
        </div>
      </div>

      <div
        className="story-carousel-shell"
        role="region"
        aria-roledescription="carousel"
        aria-label="Incident-style story cards"
        tabIndex={0}
        onKeyDown={handleTrackKeyDown}
      >
        <ul ref={trackRef} className="story-carousel-track">
          {stories.map((story, index) => (
            <li
              key={story.id}
              ref={(node) => {
                cardRefs.current[index] = node
              }}
              className={`story-card-shell ${activeIndex === index ? 'is-active' : ''}`}
              data-index={index}
              data-story-id={story.id}
            >
              <article className="story-card">
                <p className="story-card-category">{story.category}</p>
                <h3>{story.title}</h3>
                <ul className="story-card-lines">
                  {story.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="story-card-consequence">{story.consequence}</p>
                <p className="story-card-footer">Check before you share.</p>
              </article>
            </li>
          ))}
          <li
            ref={(node) => {
              cardRefs.current[stories.length] = node
            }}
            className={`story-card-shell ${activeIndex === stories.length ? 'is-active' : ''}`}
            data-index={stories.length}
          >
            <article className="story-card story-card-action">
              <p className="story-card-category">RETURN TO ANALYZER</p>
              <h3>Before it spreads, check it.</h3>
              <p className="story-card-action-copy">
                Most people realize something was fake only after they have already trusted it,
                clicked it, or shared it.
              </p>
              <Link
                className="primary-link story-card-action-link"
                href={returnHref}
                scroll={false}
                onClick={() => {
                  // TODO: Track CTA clicks once frontend-only analytics hooks can be added without changing API event validation.
                }}
              >
                Test a Real Message
              </Link>
            </article>
          </li>
        </ul>
      </div>
    </section>
  )
}
