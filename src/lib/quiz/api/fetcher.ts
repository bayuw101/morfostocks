export async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    })

    if (!res.ok) {
        let errorMessage = 'Request failed'
        try {
            const errData = await res.json()
            errorMessage = errData.error || errData.message || errorMessage
        } catch {
            // Not JSON or empty body
            errorMessage = res.statusText || errorMessage
        }
        throw new Error(errorMessage)
    }

    // Handle empty responses (like 204 No Content for DELETE)
    const text = await res.text()
    if (!text) {
        return {} as T
    }

    try {
        const json = JSON.parse(text)
        // Wrap responses with `{ data: ... }` if returned by Next.js conventions, otherwise return json
        return json.data !== undefined ? json.data : json
    } catch {
        return text as unknown as T
    }
}
