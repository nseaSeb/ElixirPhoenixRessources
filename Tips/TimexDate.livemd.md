# Timex Date notebook
[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

```elixir
Mix.install([{:timex, "~> 3.7", override: true}])
```

## Exemple d'utilisation de Timex issu de la Doc

```elixir
Timex.now()
```

<!-- livebook:{"output":true} -->

```
~U[2023-11-02 10:11:06.273755Z]
```

```elixir
Timex.today()
```

<!-- livebook:{"output":true} -->

```
~D[2023-11-02]
```

```elixir
Timex.local()
```

<!-- livebook:{"output":true} -->

```
#DateTime<2023-11-02 11:11:50.189498+01:00 CET Europe/Paris>
```

```elixir
Timex.now("Europe/Copenhagen")
```

<!-- livebook:{"output":true} -->

```
#DateTime<2023-11-02 11:12:10.190752+01:00 CET Europe/Copenhagen>
```

```elixir
Timex.to_date({2015, 6, 24})
```

<!-- livebook:{"output":true} -->

```
~D[2015-06-24]
```

```elixir
Timex.to_datetime({{2015, 6, 24}, {4, 50, 34}}, :local)
```

<!-- livebook:{"output":true} -->

```
#DateTime<2015-06-24 04:50:34+02:00 CEST Europe/Paris>
```

```elixir
Timex.parse!("2015-06-24T04:50:34-05:00", "{ISO:Extended}")
```

<!-- livebook:{"output":true} -->

```
#DateTime<2015-06-24 04:50:34-05:00 -05 Etc/UTC-5>
```

```elixir
Timex.format!(Timex.to_datetime(~N[2015-06-24T00:04:09.293], :local), "{ISO:Extended}")
```

<!-- livebook:{"output":true} -->

```
"2015-06-24T00:04:09.293+02:00"
```

```elixir
Timex.format!(Timex.to_datetime(~N[2015-06-24T00:04:09.293], "America/Chicago"), "{ISO:Extended}")
```

<!-- livebook:{"output":true} -->

```
"2015-06-24T00:04:09.293-05:00"
```

Tester si un evenement est contenu dans un interval

```elixir
use Timex
event = Timex.to_datetime({{2016, 6, 24}, {0, 0, 0}})
other_event = Timex.to_datetime({{2010, 1, 1}, {0, 0, 0}})
from = Timex.to_datetime({{2015, 1, 1}, {0, 0, 0}})
until = Timex.to_datetime({{2018, 1, 1}, {0, 0, 0}})
interval = Timex.Interval.new(from: from, until: until)
event in interval
true
other_event in interval
false
```

<!-- livebook:{"output":true} -->

```
false
```

## Exemple en utilisant Timex et le Pattern Matching pour formatter des dates

```elixir
defmodule Horodate do
  def init() do
    Timex.now()
  end

  def format_date(date, format \\ "{ISOdate}"), do: Timex.format!(date, format)
  def date_format(date, format, language \\ "fr")

  def date_format(date, "{D}-{M}-{YY}-{h24}:{m}:{s}", _) do
    Timex.format!(date, "{0D}-{0M}-{YY}-{h24}:{m}:{s}")
  end

  def date_format(date, "{D}/{M}/{YY}, {h24}:{m}:{s}", _) do
    Timex.format!(date, "{0D}/{0M}/{YY}, {h24}:{m}:{s}")
  end

  def date_format(date, "{WDshort}-{D}-{Mshort}-{YYYY}-{h24}:{m}:{s}", "en") do
    Timex.format!(date, "{YYYY}-{Mshort}-{0D}-{WDshort}-{h24}:{m}:{s}")
  end

  def date_format(date, "{WDshort}-{D}-{Mshort}-{YYYY}-{h24}:{m}:{s}", "fr") do
    Timex.format!(date, "{WDshort}-{0D}-{Mshort}-{YYYY}-{h24}:{m}:{s}")
    |> dateToFrench()
  end

  def date_format(date, "{WDfull}-{D}-{Mfull}-{YYYY}-{h24}:{m}:{s}", "en") do
    Timex.format!(date, "{WDfull}-{0D}-{Mfull}-{YYYY}-{h24}:{m}:{s}")
  end

  def date_format(date, "{WDfull}-{D}-{Mfull}-{YYYY}-{h24}:{m}:{s}", "fr") do
    Timex.format!(date, "{WDfull}-{0D}-{Mfull}-{YYYY}-{h24}:{m}:{s}")
    |> dateToFrench()
  end

  def date_format(date, _, "en") do
    Timex.format!(date, "{WDshort}-{0D}-{Mshort}-{YYYY}-{h24}:{m}:{s}")
  end

  def date_format(date, _, "fr") do
    Timex.format!(date, "{WDshort}-{0D}-{Mshort}-{YYYY}-{h24}:{m}:{s}")
    |> dateToFrench()
  end

  def date_format(date, _, _) do
    Timex.format!(date, "{WDshort}-{0D}-{Mshort}-{YYYY}-{h24}:{m}:{s}")
    |> dateToFrench()
  end

  def date_format(date) do
    Timex.format!(date, "{WDshort}-{0D}-{Mshort}-{YYYY}-{h24}:{m}:{s}")
    |> dateToFrench()
  end

  def dateToFrench(date) do
    arrDate = String.split(date, "-")

    Enum.join(
      [
        dayInFrench(Enum.at(arrDate, 0)),
        Enum.at(arrDate, 1),
        monthInFrench(Enum.at(arrDate, 2)),
        Enum.at(arrDate, 3),
        Enum.at(arrDate, 4)
      ],
      " "
    )
  end

  defp dayInFrench(day) do
    case day do
      "Sunday" -> "Dimanche"
      "Monday" -> "Lundi"
      "Tuesday" -> "Mardi"
      "Wednesday" -> "Mercredi"
      "Thursday" -> "Jeudi"
      "Friday" -> "Vendredi"
      "Saturday" -> "Samedi"
      "Sun" -> "Dim"
      "Mon" -> "Lun"
      "Tue" -> "Mar"
      "Wed" -> "Mer"
      "Thu" -> "Jeu"
      "Fri" -> "Ven"
      "Sat" -> "Sam"
      _ -> day
    end
  end

  defp monthInFrench(month) do
    case month do
      "January" -> "Janvier"
      "February" -> "Février"
      "March" -> "Mars"
      "April" -> "Avril"
      "May" -> "Mai"
      "June" -> "Juin"
      "July" -> "Juillet"
      "August" -> "Août"
      "September" -> "Septembre"
      "October" -> "Octobre"
      "November" -> "Novembre"
      "December" -> "Décembre"
      "Jan" -> "Janv"
      "Feb" -> "Fév"
      "Mar" -> "Mars"
      "Apr" -> "Avr"
      "Jun" -> "Juin"
      "Jul" -> "Juil"
      "Aug" -> "Août"
      "Sep" -> "Sept"
      "Oct" -> "Oct"
      "Nov" -> "Nov"
      "Dec" -> "Déc"
      _ -> month
    end
  end
end
```

<!-- livebook:{"output":true} -->

```
{:module, Horodate, <<70, 79, 82, 49, 0, 0, 24, ...>>, {:monthInFrench, 1}}
```

```elixir
maintenant = Timex.now()
IO.puts(maintenant)
IO.puts(Horodate.date_format(maintenant, nil))
IO.puts(Horodate.date_format(maintenant))
IO.puts(Horodate.date_format(maintenant, "{D}-{M}-{YY}-{h24}:{m}:{s}"))
IO.puts(Horodate.date_format(maintenant, "{D}/{M}/{YY}, {h24}:{m}:{s}"))
IO.puts(Horodate.date_format(maintenant, "{WDshort}-{D}-{Mshort}-{YYYY}-{h24}:{m}:{s}"))
IO.puts(Horodate.date_format(maintenant, "{WDshort}-{D}-{Mshort}-{YYYY}-{h24}:{m}:{s}", "en"))
IO.puts(Horodate.date_format(maintenant, "{WDfull}-{D}-{Mfull}-{YYYY}-{h24}:{m}:{s}"))
IO.puts(Horodate.date_format(maintenant, "{WDfull}-{D}-{Mfull}-{YYYY}-{h24}:{m}:{s}", "en"))
```

<!-- livebook:{"output":true} -->

```
2023-11-02 10:08:18.039644Z
Jeu 02 Nov 2023 10:08:18
Jeu 02 Nov 2023 10:08:18
02-11-23-10:08:18
02/11/23, 10:08:18
Jeu 02 Nov 2023 10:08:18
2023-Nov-02-Thu-10:08:18
Jeudi 02 Novembre 2023 10:08:18
Thursday-02-November-2023-10:08:18
```

<!-- livebook:{"output":true} -->

```
:ok
```
