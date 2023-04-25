import { useForm } from "react-hook-form";
import fetchWithCredentials from "../../app/utils/fetchWithCredentials";

const InputFile = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  // const onSubmit = async (data: any) => {
  //   console.log(data.file[0]);

  //   await fetch("http://localhost:3000/file/upload", {
  //     method: "POST",
  //     // headers: {
  //     //   Authorization: "Bearer " + Cookies.get("access_token"),
  //     // },
  //     body: data.file[0],
  //   });
  // };

  const onSubmit = async (data: any) => {
    console.log(data.file[0]);
    const file = data.file[0];
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetchWithCredentials("http://localhost:3000/file/upload", {
      method: "POST",
      body: formData,
      mode: 'no-cors'
    });

    console.log(res);
  };

  return (
    <form
      className="flex flex-col items-center"
      onSubmit={handleSubmit(onSubmit)}
    >
      <label className="block" htmlFor="">
        <input
          className="text-sm file:text-sm block w-full
      text-slate-500 file:mr-4 file:rounded-full
      file:border-0 file:bg-violet-50
      file:px-3 file:py-1
      file:font-semibold file:text-black
      hover:file:bg-violet-100
    "
          type="file"
          placeholder="Add a smart contract"
          accept=".sol"
          {...register("file", {})}
        />
      </label>

      <button
        className="mx-auto mt-3 h-5 rounded-2xl bg-white px-2 text-black transition-all hover:opacity-60"
        type="submit"
      >
        Check my smart contract
      </button>
    </form>
  );
};

export default InputFile;
