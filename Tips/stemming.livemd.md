# Stemming (reduction de mot) exemple

```elixir
Mix.install([{:stemmer, "~> 1.0"}])
```

## Words

```elixir
defmodule Recode do
  def format(val, id) do
    exclusion_list = ["une", "autre", "pour", "ceci", "est", "sen", "qui", "fois"]

    val
    |> String.normalize(:nfd)
    # Remplace tous les caractères non alphanumériques par ""
    |> String.replace(~r/[^A-z\s]/u, "")
    |> String.downcase()
    |> String.split(~r/\s+/)
    |> Enum.filter(&(String.length(&1) >= 3))
    |> Enum.reject(&(&1 in exclusion_list))
    |> stem_words()
    |> Enum.map(fn x -> %{val: x, id: id} end)
  end

  def stem_words(words) do
    Enum.map(words, fn x -> Stemmer.stem(x) end)
  end
end
```

<!-- livebook:{"output":true} -->

```
{:module, Recode, <<70, 79, 82, 49, 0, 0, 12, ...>>, {:stem_words, 1}}
```

```elixir
Recode.format(
  "Bonjour ceci est un Texte
 à encoder une fois pour Voir l'idée qui s'en dégage !",
  "1234"
)
```

<!-- livebook:{"output":true} -->

```
[
  %{id: "1234", val: "bonjour"},
  %{id: "1234", val: "text"},
  %{id: "1234", val: "encod"},
  %{id: "1234", val: "voir"},
  %{id: "1234", val: "lide"},
  %{id: "1234", val: "degag"}
]
```