import { useState } from "react";

export function MessageInput({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
}): JSX.Element {
  const [value, setValue] = useState("");

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        const text = value.trim();
        if (text !== "") {
          onSend(text);
          setValue("");
        }
      }}
    >
      <label className="sr-only" htmlFor="prompt">
        輸入訊息
      </label>
      <textarea
        id="prompt"
        rows={2}
        value={value}
        disabled={disabled}
        placeholder={disabled ? "未連線" : "輸入訊息…"}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" disabled={disabled || value.trim() === ""}>
        送出
      </button>
    </form>
  );
}
