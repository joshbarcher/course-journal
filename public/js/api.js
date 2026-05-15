import { getCourseId } from './course-context.js'

const BASE = '/api'

async function request(method, path, body) {
    const opts = { method, headers: {} }
    if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json'
        opts.body = JSON.stringify(body)
    }
    const res = await fetch(BASE + path, opts)
    if (res.status === 204) return null
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
    return data
}

function pagesBase() {
    const id = getCourseId()
    if (!id) throw new Error('No active course')
    return `/courses/${id}/pages`
}

export const api = {
    courses: {
        list:   ()         => request('GET',    '/courses'),
        get:    (id)       => request('GET',    `/courses/${id}`),
        create: (body)     => request('POST',   '/courses', body),
        update: (id, body) => request('PUT',    `/courses/${id}`, body),
        remove: (id)       => request('DELETE', `/courses/${id}`),
        copy:   (id)       => request('POST',   `/courses/${id}/copy`),
    },
    pages: {
        list:    ()         => request('GET',    pagesBase()),
        get:     (id)       => request('GET',    `${pagesBase()}/${id}`),
        create:  (body)     => request('POST',   pagesBase(), body),
        update:  (id, body) => request('PUT',    `${pagesBase()}/${id}`, body),
        remove:  (id)       => request('DELETE', `${pagesBase()}/${id}`),
        reorder: (ids)      => request('PUT',    `${pagesBase()}/order`, { ids }),
    },
    pagesFor: (courseId) => ({
        list: () => request('GET', `/courses/${courseId}/pages`),
    }),
}
