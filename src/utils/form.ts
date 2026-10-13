export const formText = (data: FormData, name: string) => String(data.get(name) ?? '')
